const BASE='',KEY='iris-memory-2024',H={'x-api-key':KEY,'Content-Type':'application/json'};
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICON={menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/></svg>',close:'<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',back:'<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',image:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>',send:'<svg viewBox="0 0 24 24"><path d="m5 12 14-7-5 14-2-5-7-2zM12 14l7-9"/></svg>',more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" stroke="none"/><circle cx="12" cy="12" r="1.4" stroke="none"/><circle cx="19" cy="12" r="1.4" stroke="none"/></svg>',models:'<svg viewBox="0 0 24 24"><path d="M4 7h16M7 12h10M9 17h6"/><circle cx="7" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="12" cy="17" r="2"/></svg>',role:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',profile:'<svg viewBox="0 0 24 24"><path d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6"/><circle cx="12" cy="7" r="4"/></svg>',archive:'<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></svg>',pin:'<svg viewBox="0 0 24 24"><path d="m14 4 6 6-4 2-4 4-1 5-2-5-5-1 4-4 2-4 4-3z"/></svg>',edit:'<svg viewBox="0 0 24 24"><path d="m4 20 4-1 11-11-3-3L5 16l-1 4zM14 7l3 3"/></svg>',trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',spark:'<svg viewBox="0 0 48 48"><path d="M24 5l2.8 14.2L39 24l-12.2 4.8L24 43l-2.8-14.2L9 24l12.2-4.8L24 5z"/><path d="M38 8l1 4 3 1-3 1-1 4-1-4-3-1 3-1 1-4z"/></svg>'};
const GEAR='<svg viewBox="0 0 24 24"><path d="M9.7 3.3 9.1 5a7.4 7.4 0 0 0-1.7 1L5.6 5.6 3.3 9.7 4.7 11a7.8 7.8 0 0 0 0 2l-1.4 1.3 2.3 4.1 1.8-.4a7.4 7.4 0 0 0 1.7 1l.6 1.7h4.6l.6-1.7a7.4 7.4 0 0 0 1.7-1l1.8.4 2.3-4.1-1.4-1.3a7.8 7.8 0 0 0 0-2l1.4-1.3-2.3-4.1-1.8.4a7.4 7.4 0 0 0-1.7-1l-.6-1.7H9.7Z"/><circle cx="12" cy="12" r="3.2"/></svg>';
const DEFAULT_AVATAR='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21c0-4 3.1-7 7-7s7 3 7 7"/></svg>';
let settings={presets:[],activePresetId:'',functions:{main:'',summary:'',translation:'',image:'',summaryEnabled:false,summaryThreshold:30}},conversations=[],roles=[],profile={name:'Iris',avatar:'',bio:'',details:''},current=null,messages=[],pendingImage=null,pendingRole='',pendingTurnGroupId='',sending=false,savingBubble=false,toastTimer;
async function api(path,opt={}){const r=await fetch(BASE+path,{...opt,headers:{...H,...(opt.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok){const error=new Error(data.error||`${r.status}`);error.data=data;throw error}return data}
function toast(msg,type=''){const t=$('toast');t.textContent=msg;t.className=`toast ${type} show`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',2500)}
function fileData(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)})}
async function avatarData(file){
  const raw=await fileData(file);
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const max=512;
      const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const width=Math.max(1,Math.round(img.naturalWidth*scale));
      const height=Math.max(1,Math.round(img.naturalHeight*scale));
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,width,height);
      resolve(canvas.toDataURL('image/webp',.82));
    };
    img.onerror=()=>resolve(raw);
    img.src=raw;
  });
}
function initIcons(){$('openLeft').innerHTML=ICON.menu;$('openRight').innerHTML=GEAR;$('addImage').innerHTML=ICON.image;$('sendBtn').innerHTML=ICON.send;$('askReplyBtn').innerHTML=ICON.spark;$('removeImage').innerHTML=ICON.close;$('closeWorkspace').innerHTML=ICON.back;$('closeRolePicker').innerHTML=ICON.close;$('landingMark').innerHTML=ICON.spark;$('startChatBtn').innerHTML=ICON.plus;document.querySelectorAll('.drawer-close').forEach(x=>x.innerHTML=ICON.close);$('newChatBtn').innerHTML=ICON.plus+' New chat';const nav=[['models',ICON.models,'模型设置'],['roles',ICON.role,'角色卡'],['archive',ICON.archive,'归档']];nav.forEach(([id,icon,label])=>{const button=document.querySelector(`[data-panel="${id}"]`);if(button)button.innerHTML=icon+label})}
function initTopBar(){const a=localStorage.getItem('iris_avatar_img1'),n=localStorage.getItem('iris_avatar_name1')||profile.name||'Iris',t=localStorage.getItem('iris_topbar_title')||(n+'的小窝');$('topBarAvatar').innerHTML=a?`<img src="${a}" alt="">`:`<span class="top-bar-avatar-initial">${esc(n[0]||'I')}</span>`;$('topBarTitle').textContent=t;$('topBarTitle').onclick=()=>{const v=prompt('自定义顶栏文字',t);if(v?.trim()){localStorage.setItem('iris_topbar_title',v.trim());$('topBarTitle').textContent=v.trim()}}}
function showLanding(){current=null;messages=[];pendingTurnGroupId='';document.body.classList.remove('chat-room');$('landing').style.display='flex';$('messages').style.display='none';$('chatTitle').textContent='New chat';$('chatInput').placeholder='跟TA说点什么…';resetComposerInput();updateReplyButton();const name=profile.name||'Iris',lines=[`Good to see you, ${name}.`,`A quiet place for you, ${name}.`,`What would you like to talk about, ${name}?`,`Take a breath, ${name}. I am here with you.`,`Where should we begin, ${name}?`];$('greeting').textContent=lines[Math.floor(Math.random()*lines.length)];renderConversations();closeDrawers()}
function closeDrawers(){$('leftDrawer').classList.remove('open');$('rightDrawer').classList.remove('open');$('scrim').classList.remove('open')}
function openDrawer(side){closeDrawers();$(side==='left'?'leftDrawer':'rightDrawer').classList.add('open');$('scrim').classList.add('open');if(side==='right')hydrateRight()}
function conversationRow(c){return `<div class="conversation ${current?.id===c.id?'active':''}" data-id="${c.id}"><span class="conversation-title">${esc(c.title)}</span><button class="more-btn" aria-label="对话菜单">${ICON.more}</button></div>`}
function renderConversations(){const visible=conversations.filter(c=>!c.archived),pinned=visible.filter(c=>c.pinned),recent=visible.filter(c=>!c.pinned);$('pinnedList').innerHTML=pinned.map(conversationRow).join('')||'<div class="empty-note">暂无置顶对话</div>';$('recentList').innerHTML=recent.map(conversationRow).join('')||'<div class="empty-note">暂无最近对话</div>';document.querySelectorAll('.conversation-title').forEach(x=>x.onclick=()=>openConversation(x.parentElement.dataset.id));document.querySelectorAll('.conversation .more-btn').forEach(x=>x.onclick=e=>openConversationMenu(x.parentElement.dataset.id,e.currentTarget))}
function openConversationMenu(id,btn){const c=conversations.find(x=>x.id===id),m=$('conversationMenu'),r=btn.getBoundingClientRect();m.dataset.id=id;m.innerHTML=`<button data-act="rename">${ICON.edit}重命名</button><button data-act="pin">${ICON.pin}${c.pinned?'取消置顶':'置顶'}</button><button data-act="archive">${ICON.archive}归档</button><button class="danger" data-act="delete">${ICON.trash}删除</button>`;m.style.left=Math.min(r.left,innerWidth-155)+'px';m.style.top=Math.min(r.bottom+4,innerHeight-185)+'px';m.classList.add('open')}
async function conversationAction(act,id){const c=conversations.find(x=>x.id===id);if(!c)return;if(act==='rename'){const title=prompt('重命名对话',c.title);if(!title?.trim())return;await updateConversation(id,{title:title.trim()})}if(act==='pin')await updateConversation(id,{pinned:!c.pinned});if(act==='archive'){await updateConversation(id,{archived:true});if(current?.id===id)showLanding()}if(act==='delete'){if(!confirm(`删除“${c.title}”及其消息？`))return;await api(`/api/chat/conversations/${id}`,{method:'DELETE'});conversations=conversations.filter(x=>x.id!==id);if(current?.id===id)showLanding()}renderConversations();renderArchive()}
async function updateConversation(id,patch){const updated=await api(`/api/chat/conversations/${id}`,{method:'PUT',body:JSON.stringify(patch)});const i=conversations.findIndex(x=>x.id===id);if(i>=0)conversations[i]=updated;if(current?.id===id)current=updated;return updated}
async function openConversation(id){current=conversations.find(x=>x.id===id);if(!current)return;document.body.classList.add('chat-room');$('chatTitle').textContent=current.title;const role=roles.find(r=>r.id===current.roleId);$('chatInput').placeholder=`跟 ${role?.name||'TA'} 说点什么…`;$('landing').style.display='none';$('messages').style.display='flex';closeDrawers();const data=await api(`/api/chat/messages?conversationId=${encodeURIComponent(id)}&limit=100`);messages=data.messages||[];pendingTurnGroupId=getPendingTurnGroupId(messages);resetComposerInput();renderMessages();hydrateRight();scrollBottom()}
function roleAvatar(role){if(role?.avatar)return `<img src="${role.avatar}" alt="${esc(role.name||'TA')}">`;return DEFAULT_AVATAR}
function irisAvatar(){const avatar=profile?.avatar||localStorage.getItem('iris_avatar_img1')||'';return avatar?`<img src="${avatar}" alt="${esc(profile?.name||'Iris')}">`:DEFAULT_AVATAR}
function messageTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
function messageDateKey(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
function messageDateLabel(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':`${date.getMonth()+1}月${date.getDate()}日`}
function groupMessages(list){const groups=[];for(const message of list){const previous=groups[groups.length-1],groupId=message.replyGroupId||'',sameDay=previous&&messageDateKey(message.createdAt)===messageDateKey(previous.last.createdAt),sameExplicit=previous&&sameDay&&groupId&&previous.groupId===groupId&&previous.role===message.role;const elapsed=previous?Math.abs(new Date(message.createdAt).getTime()-new Date(previous.last.createdAt).getTime()):Infinity;const sameLegacy=previous&&sameDay&&!groupId&&!previous.groupId&&previous.role===message.role&&elapsed<=30000;if(sameExplicit||sameLegacy){previous.messages.push(message);previous.last=message}else groups.push({groupId,role:message.role,messages:[message],last:message})}return groups}
function getPendingTurnGroupId(list=messages){const last=groupMessages(list).at(-1);return last?.role==='iris'?(last.groupId||''):''}
function messageContent(message){const image=message.image?`<img class="sent-image" src="${message.image}" alt="发送的图片">`:'';const bubble=message.content?`<div class="bubble">${esc(message.content)}</div>`:'';return image+bubble}
function renderGroup(group,role){const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt),person=`<div class="avatar-stack"><div class="avatar">${avatar}</div><time class="avatar-time">${esc(time)}</time></div>`,bubbles=`<div class="bubble-stack">${group.messages.map(messageContent).join('')}</div>`;return `<div class="message-group ${user?'user':'assistant'}">${user?bubbles+person:person+bubbles}</div>`}
function updateReplyButton(){const button=$('askReplyBtn');if(!button)return;const hasPending=!!pendingTurnGroupId&&messages.some(m=>m.role==='iris'&&m.replyGroupId===pendingTurnGroupId);button.disabled=!hasPending||sending;button.classList.toggle('active',hasPending);button.title=hasPending?'让 TA 回复':'先发送一条消息'}
function renderMessages(){const role=roles.find(r=>r.id===current?.roleId);let lastDate='';$('messages').innerHTML=groupMessages(messages).map(group=>{const key=messageDateKey(group.messages[0].createdAt),divider=key&&key!==lastDate?`<div class="date-divider"><span>${esc(messageDateLabel(group.messages[0].createdAt))}</span></div>`:'';lastDate=key||lastDate;return divider+renderGroup(group,role)}).join('');updateReplyButton()}
function scrollBottom(){requestAnimationFrame(()=>$('chatMain').scrollTop=$('chatMain').scrollHeight)}
function renderTyping(){return `<div class="message-group assistant typing-group" id="typing"><div class="avatar-stack"><div class="avatar">${roleAvatar(roles.find(r=>r.id===current?.roleId))}</div></div><div class="bubble-stack"><div class="bubble typing"><i></i><i></i><i></i></div></div></div>`}
async function ensureConversation(){if(current)return true;if(!roles.length){openPanel('roles');toast('请先创建一个角色卡');return false}pendingRole=roles[0].id;renderRolePicker();$('rolePicker').classList.add('open');return false}
function renderRolePicker(){$('rolePickerList').innerHTML=roles.map(r=>`<button class="role-choice ${pendingRole===r.id?'selected':''}" data-id="${r.id}"><span class="avatar">${roleAvatar(r)}</span><span>${esc(r.name)}</span></button>`).join('');document.querySelectorAll('.role-choice').forEach(x=>x.onclick=()=>{pendingRole=x.dataset.id;renderRolePicker()})}
async function createConversationFromPicker(){if(!pendingRole)return toast('请选择角色');const c=await api('/api/chat/conversations',{method:'POST',body:JSON.stringify({title:'New chat',roleId:pendingRole,presetId:settings.activePresetId,model:settings.functions?.main||''})});conversations.unshift(c);$('rolePicker').classList.remove('open');await openConversation(c.id)}
const createConversationAndSend=createConversationFromPicker;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function refreshConversationMeta(){const fresh=await api('/api/chat/conversations');conversations=fresh.conversations||conversations;current=conversations.find(x=>x.id===current?.id)||current;if(current)$('chatTitle').textContent=current.title;renderConversations()}
async function revealAiMessages(aiMessages,baseMessages){messages=baseMessages;renderMessages();for(const message of aiMessages){$('messages').insertAdjacentHTML('beforeend',renderTyping());scrollBottom();const pause=Math.min(1500,Math.max(600,350+String(message.content||'').length*16));await sleep(pause);$('typing')?.remove();messages.push(message);renderMessages();scrollBottom()}}
async function recoverTimedOutReply(conversationId,knownIds,startedAt){for(let attempt=0;attempt<45;attempt++){await sleep(2000);try{const data=await api(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&limit=100`),all=data.messages||[],freshAi=all.filter(m=>m.role!=='iris'&&!knownIds.has(m.id)&&new Date(m.createdAt).getTime()>=startedAt-5000);if(freshAi.length)return{all,freshAi}}catch{}}return null}
function resetComposerInput(){const input=$('chatInput');if(!input)return;input.value='';input.style.height='38px'}
async function sendUserBubbleLegacy(){if(savingBubble)return;const text=$('chatInput').value.trim();if(!text&&!pendingImage)return toast('先写点什么吧');if(!current){await ensureConversation();return}savingBubble=true;$('sendBtn').disabled=true;const conversationId=current.id,image=pendingImage,groupId=pendingTurnGroupId||`turn-${Date.now()}`,tempId=`temp-${Date.now()}`;pendingTurnGroupId=groupId;const temp={id:tempId,replyGroupId:groupId,conversationId,role:'iris',content:text,image,createdAt:new Date().toISOString()};resetComposerInput();clearImage();messages.push(temp);renderMessages();scrollBottom();try{const saved=await api('/api/chat/messages',{method:'POST',body:JSON.stringify({conversationId,content:text,image,replyGroupId:groupId})});const index=messages.findIndex(m=>m.id===tempId);if(index>=0)messages[index]=saved;else if(!messages.some(m=>m.id===saved.id))messages.push(saved);renderMessages();await refreshConversationMeta()}catch(e){messages=messages.filter(m=>m.id!==tempId);if(!messages.some(m=>m.role==='iris'&&m.replyGroupId===groupId))pendingTurnGroupId='';renderMessages();toast('发送失败：'+e.message,'error')}finally{savingBubble=false;$('sendBtn').disabled=false;updateReplyButton();scrollBottom()}}
async function requestAiReply(){if(sending||!current)return;const groupId=pendingTurnGroupId||getPendingTurnGroupId(messages),userTurn=messages.filter(m=>m.role==='iris'&&m.replyGroupId===groupId);if(!groupId||!userTurn.length)return toast('先发一条消息吧');sending=true;updateReplyButton();const conversationId=current.id,knownIds=new Set(messages.map(m=>m.id)),startedAt=Date.now();$('messages').insertAdjacentHTML('beforeend',renderTyping());scrollBottom();try{const data=await api('/api/chat/send',{method:'POST',body:JSON.stringify({conversationId,replyGroupId:groupId,settings})}),base=messages;for(const m of data.userMessages||[])if(!base.some(x=>x.id===m.id))base.push(m);await revealAiMessages(data.aiMessages||[],base);pendingTurnGroupId='';await refreshConversationMeta()}catch(e){const mayStillFinish=e.message==='504'||/timeout|network|failed to fetch/i.test(e.message);if(mayStillFinish){toast('连接超时，回复仍在生成…');const recovered=await recoverTimedOutReply(conversationId,knownIds,startedAt);if(recovered){const freshIds=new Set(recovered.freshAi.map(m=>m.id)),base=recovered.all.filter(m=>!freshIds.has(m.id));await revealAiMessages(recovered.freshAi,base);pendingTurnGroupId='';await refreshConversationMeta();toast('回复已接收','success')}else{try{messages=(await api(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&limit=100`)).messages||[]}catch{}pendingTurnGroupId=getPendingTurnGroupId(messages);renderMessages();toast('回复等待超时，请稍后重新进入查看','error')}}else{try{messages=(await api(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&limit=100`)).messages||[]}catch{}pendingTurnGroupId=getPendingTurnGroupId(messages);renderMessages();toast('发送失败：'+e.message,'error')}}finally{sending=false;updateReplyButton();scrollBottom()}}
function clearImageLegacy(){pendingImage=null;$('imageInput').value='';$('imagePreview').classList.remove('show')}
function allModels(){return (settings.presets||[]).flatMap(p=>(p.models||[p.model].filter(Boolean)).map(m=>({value:`${p.id}::${m}`,label:`${p.name||'预设'} · ${m}`,presetId:p.id,model:m})))}
function fillModelSelect(elm,includeEmpty=true){const arr=allModels(),value=elm.value;elm.innerHTML=(includeEmpty?'<option value="">使用主模型</option>':'<option value="">请选择主模型</option>')+arr.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');elm.value=value}
function hydrateRight(){const opts=allModels();$('conversationModel').innerHTML='<option value="">跟随主模型</option>'+opts.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');if(current)$('conversationModel').value=current.presetId&&current.model?`${current.presetId}::${current.model}`:'';const a=current?.appearance||{};$('multiBubble').checked=!!current?.multiBubble;$('avatarSize').value=a.avatarSize||34;$('avatarRadius').value=a.avatarRadius??50;$('bubbleWidth').value=a.bubbleWidth||75;const cs=getComputedStyle(document.documentElement);$('userBubble').value=a.userBubble||toHex(cs.getPropertyValue('--accent-pale').trim())||'#e8eeee';$('aiBubble').value=a.aiBubble||'#ffffff';applyAppearance()}
function toHex(c){if(/^#[0-9a-f]{6}$/i.test(c))return c;return ''}
function applyAppearance(){const a=current?.appearance||{};document.documentElement.style.setProperty('--chat-avatar-size',(a.avatarSize||34)+'px');document.documentElement.style.setProperty('--chat-avatar-radius',(a.avatarRadius??50)+'%');document.documentElement.style.setProperty('--bubble-width',(a.bubbleWidth||75)+'%');if(a.userBubble)document.documentElement.style.setProperty('--chat-user-bubble',a.userBubble);else document.documentElement.style.removeProperty('--chat-user-bubble');if(a.aiBubble)document.documentElement.style.setProperty('--chat-ai-bubble',a.aiBubble);else document.documentElement.style.removeProperty('--chat-ai-bubble');if(a.userBubbleText)document.documentElement.style.setProperty('--chat-user-bubble-text',a.userBubbleText);else document.documentElement.style.removeProperty('--chat-user-bubble-text');if(a.aiBubbleText)document.documentElement.style.setProperty('--chat-ai-bubble-text',a.aiBubbleText);else document.documentElement.style.removeProperty('--chat-ai-bubble-text')}
async function saveConversationSettings(){if(!current)return;const val=$('conversationModel').value,[presetId='',model='']=val.split('::'),appearance={avatarSize:+$('avatarSize').value,avatarRadius:+$('avatarRadius').value,bubbleWidth:+$('bubbleWidth').value,userBubble:$('userBubble').value,aiBubble:$('aiBubble').value};await updateConversation(current.id,{presetId,model,multiBubble:$('multiBubble').checked,appearance});applyAppearance()}
function openPanel(name){closeDrawers();document.body.classList.add('workspace-open');$('workspace').classList.add('open');document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));$(`panel-${name}`).classList.add('active');$('workspaceTitle').textContent={models:'模型设置',roles:'角色卡',archive:'归档'}[name];if(name==='models')renderModelSettings();if(name==='roles'){hydrateProfile();renderRoles()}if(name==='archive')renderArchive()}
function renderModelSettings(){const ps=settings.presets||[];$('presetCards').innerHTML=ps.map(p=>`<div class="role-card card"><div class="role-info"><strong>${esc(p.name||'未命名预设')}</strong><p>${esc((p.models||[p.model]).filter(Boolean).join('、'))}</p></div><button class="btn btn-outline edit-preset" data-id="${p.id}">编辑</button><button class="btn btn-outline delete-preset" data-id="${p.id}">删除</button></div>`).join('')||'<div class="empty-note">还没有模型预设</div>';document.querySelectorAll('.edit-preset').forEach(x=>x.onclick=()=>editPreset(x.dataset.id));document.querySelectorAll('.delete-preset').forEach(x=>x.onclick=()=>deletePreset(x.dataset.id));['mainModel','summaryModel','translationModel','imageModel'].forEach((id,i)=>fillModelSelect($(id),i>0));const f=settings.functions||{};$('mainModel').value=f.main||'';$('summaryModel').value=f.summary||'';$('translationModel').value=f.translation||'';$('imageModel').value=f.image||'';$('summaryEnabled').checked=!!f.summaryEnabled;$('summaryThreshold').value=f.summaryThreshold||30}
function editPreset(id){const p=settings.presets.find(x=>x.id===id);if(!p)return;$('editingPresetId').value=p.id;$('presetName').value=p.name||'';$('apiProvider').value=p.provider||'openai';$('baseUrl').value=p.baseUrl||'';$('apiKey').value=p.apiKey||'';renderFetchedModels(p.models||[p.model].filter(Boolean),p.models||[p.model].filter(Boolean))}
function clearPreset(){$('editingPresetId').value='';$('presetName').value='';$('apiProvider').value='openai';$('baseUrl').value='';$('apiKey').value='';$('modelsList').innerHTML='<span class="empty-note">填写地址与 Key 后拉取模型</span>';updateProviderHints()}
function updateProviderHints(){var p=$('apiProvider').value;if(p==='cc'){$('baseUrl').placeholder='http://你的US服务器IP:3001';$('apiKey').placeholder='Relay Token'}else if(p==='anthropic'){$('baseUrl').placeholder='https://api.anthropic.com';$('apiKey').placeholder='sk-ant-...'}else{$('baseUrl').placeholder='https://api.example.com/v1 或完整端点';$('apiKey').placeholder='sk-...'}}
function renderFetchedModels(models,selected=[]){$('modelsList').innerHTML=models.map(m=>{const id=typeof m==='string'?m:m.id||m.name;return `<label class="model-check"><input type="checkbox" value="${esc(id)}" ${selected.includes(id)?'checked':''}> <span>${esc(id)}</span></label>`}).join('')||'<span class="empty-note">没有返回模型</span>'}
async function fetchModels(){const baseUrl=$('baseUrl').value.trim(),apiKey=$('apiKey').value.trim(),provider=$('apiProvider').value;if(!baseUrl||!apiKey)return toast('请填写 API 地址和 Key');$('fetchModels').disabled=true;$('fetchModels').textContent='拉取中…';try{const d=await api('/api/chat/models',{method:'POST',body:JSON.stringify({baseUrl,apiKey,provider})});renderFetchedModels(d.models||[]);toast(`已拉取 ${(d.models||[]).length} 个模型`,'success')}catch(e){toast(e.message,'error')}finally{$('fetchModels').disabled=false;$('fetchModels').textContent='拉取模型'}}
async function savePreset(){const models=[...document.querySelectorAll('#modelsList input:checked')].map(x=>x.value),id=$('editingPresetId').value||`preset-${Date.now()}`;if(!models.length)return toast('至少选择一个模型');const item={id,name:$('presetName').value.trim()||'未命名预设',provider:$('apiProvider').value,baseUrl:$('baseUrl').value.trim(),apiKey:$('apiKey').value.trim(),models,model:models[0]},idx=settings.presets.findIndex(x=>x.id===id);if(idx>=0)settings.presets[idx]=item;else settings.presets.push(item);if(!settings.activePresetId)settings.activePresetId=id;await saveSettings();clearPreset();renderModelSettings();toast('模型预设已保存','success')}
async function deletePreset(id){if(!confirm('删除这个模型预设？'))return;settings.presets=settings.presets.filter(x=>x.id!==id);if(settings.activePresetId===id)settings.activePresetId=settings.presets[0]?.id||'';await saveSettings();renderModelSettings()}
async function saveSettings(){settings=await api('/api/chat/settings',{method:'PUT',body:JSON.stringify(settings)})}
async function saveFunctions(){if(!$('mainModel').value)return toast('主模型必须选择');settings.functions={main:$('mainModel').value,summary:$('summaryModel').value,translation:$('translationModel').value,image:$('imageModel').value,summaryEnabled:$('summaryEnabled').checked,summaryThreshold:+$('summaryThreshold').value||30};const [presetId,model]=settings.functions.main.split('::');settings.activePresetId=presetId;const p=settings.presets.find(x=>x.id===presetId);if(p)p.model=model;await saveSettings();toast('功能模型已保存','success')}
function setAvatarPreview(id,data,name){const el=$(id);el.innerHTML=data?`<img src="${data}" alt="">`:DEFAULT_AVATAR}
function switchIdentity(name){document.querySelectorAll('.identity-tab').forEach(x=>x.classList.toggle('active',x.dataset.identity===name));document.querySelectorAll('.identity-editor').forEach(x=>x.classList.remove('active'));$(`identity-${name}`).classList.add('active');if(name==='iris')hydrateProfile();else renderRoles()}
function renderRoles(){$('roleCards').innerHTML=roles.map(r=>`<div class="saved-role-card role-card card"><div class="avatar">${roleAvatar(r)}</div><div class="role-info"><strong>${esc(r.name)}</strong><p>${esc(r.identity||r.relationship||'角色卡')}</p></div><button class="more-btn role-more" data-id="${r.id}" aria-label="角色卡菜单">${ICON.more}</button></div>`).join('')||'<div class="empty-note">还没有角色卡</div>';document.querySelectorAll('.role-more').forEach(x=>x.onclick=e=>openRoleMenu(x.dataset.id,e.currentTarget))}
function openRoleMenu(id,btn){const menu=$('roleMenu'),rect=btn.getBoundingClientRect();menu.dataset.id=id;menu.innerHTML=`<button data-act="edit">${ICON.edit}编辑</button><button class="danger" data-act="delete">${ICON.trash}删除</button>`;menu.style.left=Math.min(rect.left,innerWidth-155)+'px';menu.style.top=Math.min(rect.bottom+4,innerHeight-120)+'px';menu.classList.add('open')}
function clearRole(){$('roleId').value='';$('roleName').value='';$('roleIdentity').value='';$('rolePrompt').value='';$('roleRelationship').value='';$('roleMemory').checked=true;$('roleAvatarFile').value='';$('roleAvatarFile').dataset.data='';$('roleEditorTitle').textContent='创建角色卡';setAvatarPreview('roleAvatarPreview','', 'TA')}
function editRole(id){const r=roles.find(x=>x.id===id);if(!r)return;switchIdentity('role');$('roleId').value=r.id;$('roleName').value=r.name||'';$('roleIdentity').value=r.identity||'';$('rolePrompt').value=r.prompt||'';$('roleRelationship').value=r.relationship||'';$('roleMemory').checked=r.memoryEnabled!==false;$('roleAvatarFile').dataset.data=r.avatar||'';$('roleEditorTitle').textContent='编辑角色卡';setAvatarPreview('roleAvatarPreview',r.avatar,r.name);$('workspace').scrollTo({top:0,behavior:'smooth'})}
async function saveRole(){const name=$('roleName').value.trim();if(!name)return toast('请填写角色名称');const button=$('saveRole');button.disabled=true;try{const body={name,identity:$('roleIdentity').value.trim(),prompt:$('rolePrompt').value.trim(),relationship:$('roleRelationship').value.trim(),memoryEnabled:$('roleMemory').checked,avatar:$('roleAvatarFile').dataset.data||''},id=$('roleId').value;if(id)await api(`/api/chat/roles/${id}`,{method:'PUT',body:JSON.stringify(body)});else await api('/api/chat/roles',{method:'POST',body:JSON.stringify(body)});roles=(await api('/api/chat/roles')).roles||[];clearRole();renderRoles();toast('角色卡已保存','success')}catch(e){toast('保存失败：'+e.message,'error')}finally{button.disabled=false}}
async function deleteRole(id){if(conversations.some(c=>c.roleId===id))return toast('这个角色仍绑定着对话，暂不能删除');if(!confirm('删除这个角色卡？'))return;await api(`/api/chat/roles/${id}`,{method:'DELETE'});roles=roles.filter(x=>x.id!==id);renderRoles()}
function hydrateProfile(){$('profileName').value=profile.name||'Iris';$('profileIdentity').value=profile.identity||'';$('profileDetails').value=profile.details||'';$('profileAvatarFile').dataset.data=profile.avatar||'';setAvatarPreview('profileAvatarPreview',profile.avatar,profile.name||'Iris')}
async function saveProfile(){const button=$('saveProfile');button.disabled=true;try{profile=await api('/api/chat/profile',{method:'PUT',body:JSON.stringify({name:$('profileName').value.trim()||'Iris',identity:$('profileIdentity').value.trim(),details:$('profileDetails').value.trim(),avatar:$('profileAvatarFile').dataset.data||profile.avatar||''})});localStorage.setItem('iris_avatar_name1',profile.name);if(profile.avatar)localStorage.setItem('iris_avatar_img1',profile.avatar);initTopBar();hydrateProfile();toast('我的角色卡已保存','success')}catch(e){toast('保存失败：'+e.message,'error')}finally{button.disabled=false}}
function renderArchive(){const arr=conversations.filter(c=>c.archived);$('archiveList').innerHTML=arr.map(c=>`<div class="role-card card"><div class="role-info"><strong>${esc(c.title)}</strong><p>${new Date(c.updatedAt).toLocaleDateString('zh-CN')}</p></div><button class="btn btn-outline restore-chat" data-id="${c.id}">恢复</button></div>`).join('')||'<div class="empty-note">暂无归档对话</div>';document.querySelectorAll('.restore-chat').forEach(x=>x.onclick=async()=>{await updateConversation(x.dataset.id,{archived:false});renderArchive();renderConversations()})}
function bind(){ $('openLeft').onclick=()=>openDrawer('left');$('openRight').onclick=()=>openDrawer('right');$('scrim').onclick=closeDrawers;document.querySelectorAll('.drawer-close').forEach(x=>x.onclick=closeDrawers);$('newChatBtn').onclick=showLanding;document.querySelectorAll('.nav-action').forEach(x=>x.onclick=()=>openPanel(x.dataset.panel));$('closeWorkspace').onclick=()=>$('workspace').classList.remove('open');$('conversationMenu').onclick=e=>{const b=e.target.closest('button');if(b)conversationAction(b.dataset.act,$('conversationMenu').dataset.id);$('conversationMenu').classList.remove('open')};document.addEventListener('click',e=>{if(!e.target.closest('.more-btn')&&!e.target.closest('#conversationMenu'))$('conversationMenu').classList.remove('open')});$('sendBtn').onclick=sendUserBubble;$('askReplyBtn').onclick=requestAiReply;$('chatInput').oninput=e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,96)+'px'};$('addImage').onclick=()=>$('imageInput').click();$('imageInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;pendingImage=await fileData(f);$('previewImg').src=pendingImage;$('previewName').textContent=f.name;$('imagePreview').classList.add('show')};$('removeImage').onclick=clearImage;$('closeRolePicker').onclick=()=>$('rolePicker').classList.remove('open');$('confirmRole').onclick=createConversationAndSend;$('createRoleFromPicker').onclick=()=>{$('rolePicker').classList.remove('open');openPanel('roles')};$('fetchModels').onclick=fetchModels;$('savePreset').onclick=savePreset;$('newPreset').onclick=clearPreset;$('saveFunctions').onclick=saveFunctions;$('saveRole').onclick=saveRole;$('clearRole').onclick=clearRole;$('saveProfile').onclick=saveProfile;$('apiProvider').onchange=updateProviderHints;$('roleAvatarFile').onchange=async e=>{if(e.target.files[0])e.target.dataset.data=await avatarData(e.target.files[0])};$('profileAvatarFile').onchange=async e=>{if(e.target.files[0])e.target.dataset.data=await avatarData(e.target.files[0])};['conversationModel','multiBubble','avatarSize','avatarRadius','bubbleWidth','userBubble','aiBubble'].forEach(id=>$(id).onchange=saveConversationSettings)}
function ensureNotificationBootEntry(){const nav=document.querySelector('#leftDrawer .nav-grid');if(!nav||nav.querySelector('[data-panel="notifications"]'))return;const button=document.createElement('button');button.type='button';button.className='nav-action';button.dataset.panel='notifications';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>通知';nav.appendChild(button)}
async function init(){initIcons();ensureNotificationBootEntry();bind();try{const [s,c,r,p]=await Promise.all([api('/api/chat/settings'),api('/api/chat/conversations'),api('/api/chat/roles'),api('/api/chat/profile')]);settings={...settings,...s,functions:{...settings.functions,...(s.functions||{})}};conversations=c.conversations||[];roles=r.roles||[];profile=p||profile}catch(e){toast('聊天数据加载失败：'+e.message,'error')}initTopBar();const requestedConversationId=new URLSearchParams(location.search).get('conversationId');if(requestedConversationId&&conversations.some(item=>String(item.id)===String(requestedConversationId))){history.replaceState(null,'',location.pathname);await openConversation(requestedConversationId)}else showLanding()}
init();
// Landing-page entry point: choose a role before a room is created.
document.addEventListener('DOMContentLoaded',()=>{
  $('startChatBtn').onclick=()=>{pendingRole=roles[0]?.id||'';if(!roles.length){openPanel('roles');toast('还没有角色卡，先创建一个角色吧');return}renderRolePicker();$('rolePicker').classList.add('open')};
  $('confirmRole').onclick=createConversationFromPicker;
  $('closeWorkspace').onclick=()=>{$('workspace').classList.remove('open');document.body.classList.remove('workspace-open')};
  document.querySelectorAll('.identity-tab').forEach(x=>x.onclick=()=>switchIdentity(x.dataset.identity));
  $('roleAvatarFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const data=await avatarData(file);e.target.dataset.data=data;setAvatarPreview('roleAvatarPreview',data,$('roleName').value||'TA')};
  $('profileAvatarFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const data=await avatarData(file);e.target.dataset.data=data;setAvatarPreview('profileAvatarPreview',data,$('profileName').value||'Iris')};
  $('roleName').oninput=e=>{if(!$('roleAvatarFile').dataset.data)setAvatarPreview('roleAvatarPreview','',e.target.value||'TA')};
  $('profileName').oninput=e=>{if(!$('profileAvatarFile').dataset.data)setAvatarPreview('profileAvatarPreview','',e.target.value||'Iris')};
  $('roleMenu').onclick=e=>{const button=e.target.closest('button');if(!button)return;const id=$('roleMenu').dataset.id;$('roleMenu').classList.remove('open');if(button.dataset.act==='edit')editRole(id);if(button.dataset.act==='delete')deleteRole(id)};
  document.addEventListener('click',e=>{if(!e.target.closest('.role-more')&&!e.target.closest('#roleMenu'))$('roleMenu').classList.remove('open')});
});

// Multi-photo chat cards.  Written specifically for this app; visually inspired by
// PhotoStack (Wren036/PhotoStack), which is credited in PHOTOSTACK-ATTRIBUTION.md.
let pendingImages=[];
function chatImages(message){const list=Array.isArray(message.images)&&message.images.length?message.images:(message.image?[message.image]:[]);return list.filter(x=>typeof x==='string'&&x)}
function photoStackMarkup(message){const images=chatImages(message);if(!images.length)return '';const packed=encodeURIComponent(JSON.stringify(images));if(images.length===1)return `<button class="chat-photo-single" data-photo-images="${packed}" aria-label="查看图片"><img src="${images[0]}" alt="发送的图片"></button>`;const cards=images.slice(0,4).map((src,index)=>`<span class="chat-photo-card photo-card-${index}"><img src="${src}" alt="图片 ${index+1}"></span>`).join('');return `<button class="chat-photo-stack" data-photo-images="${packed}" aria-label="查看 ${images.length} 张图片">${cards}<span class="chat-photo-count">${images.length} 张</span></button>`}
messageContent=function(message){const photos=photoStackMarkup(message);const bubble=message.content?`<div class="bubble">${esc(message.content)}</div>`:'';return photos+bubble}
renderGroup=function(group,role){const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt),person=`<div class="avatar-stack"><div class="avatar">${avatar}</div><time class="avatar-time">${esc(time)}</time></div>`,bubbles=`<div class="bubble-stack">${group.messages.map(messageContent).join('')}</div>`;return `<div class="message-group ${user?'user':'assistant'}">${user?bubbles+person:person+bubbles}</div>`}
function injectPhotoStackStyles(){if($('chatPhotoStackStyles'))return;document.head.insertAdjacentHTML('beforeend',`<style id="chatPhotoStackStyles">
.chat-photo-single,.chat-photo-stack{appearance:none;border:0;background:none;padding:0;display:block;cursor:pointer;position:relative;margin:0 0 8px;max-width:min(260px,72vw)}
.chat-photo-single img{display:block;width:min(260px,72vw);max-height:300px;object-fit:cover;border-radius:16px;border:1px solid var(--chat-border)}
.chat-photo-stack{width:min(230px,62vw);height:min(280px,70vw);margin-right:18px}.assistant .chat-photo-stack,.assistant .chat-photo-single{margin-left:0}.user .chat-photo-stack,.user .chat-photo-single{margin-left:auto}
.chat-photo-card{position:absolute;inset:0;overflow:hidden;border-radius:16px;border:1px solid rgba(78,57,39,.16);box-shadow:0 5px 16px rgba(73,53,38,.16);background:#eee;transition:transform .2s ease}.chat-photo-card img{width:100%;height:100%;object-fit:cover;display:block}.photo-card-0{transform:translate(0,0) rotate(-1deg);z-index:4}.photo-card-1{transform:translate(10px,-7px) rotate(2deg);z-index:3}.photo-card-2{transform:translate(18px,-13px) rotate(-3deg);z-index:2}.photo-card-3{transform:translate(25px,-18px) rotate(4deg);z-index:1}.chat-photo-stack:hover .photo-card-0{transform:translate(-3px,2px) rotate(-2deg)}
.chat-photo-count{position:absolute;right:10px;bottom:10px;z-index:6;background:rgba(42,34,28,.68);color:#fff;border-radius:999px;padding:4px 9px;font-size:12px;font-family:inherit}
.composer-preview{display:none!important}.composer-preview.show{display:grid!important;grid-template-columns:repeat(4,56px);gap:8px;align-items:center}.composer-photo{width:56px;height:56px;position:relative;margin:0}.composer-photo img{width:56px!important;height:56px!important;object-fit:cover;border-radius:11px}.composer-photo button{position:absolute;right:-5px;top:-5px;width:19px;height:19px;border-radius:50%;border:2px solid #fff;background:#765b42;color:#fff;line-height:14px;font-size:15px;padding:0}.composer-photo-more{font-size:12px;color:var(--muted)}
.photo-viewer{position:fixed;inset:0;z-index:9999;background:rgba(20,17,14,.92);display:none;align-items:center;justify-content:center;padding:18px}.photo-viewer.open{display:flex}.photo-viewer img{max-width:100%;max-height:82vh;object-fit:contain;border-radius:12px}.photo-viewer-close,.photo-viewer-prev,.photo-viewer-next{position:absolute;border:0;color:#fff;background:rgba(255,255,255,.18);width:42px;height:42px;border-radius:50%;font-size:28px;line-height:1}.photo-viewer-close{right:18px;top:18px}.photo-viewer-prev{left:14px;top:50%}.photo-viewer-next{right:14px;top:50%}.photo-viewer-count{position:absolute;bottom:24px;color:#fff;background:rgba(0,0,0,.35);padding:5px 10px;border-radius:999px;font-size:13px}
</style>`)}
function showPendingImages(){const box=$('imagePreview');if(!box)return;box.classList.toggle('show',pendingImages.length>0);box.innerHTML=pendingImages.map((src,index)=>`<figure class="composer-photo"><img src="${src}" alt="待发送图片 ${index+1}"><button type="button" data-remove-photo="${index}" aria-label="移除图片">×</button></figure>`).join('')+(pendingImages.length?`<span class="composer-photo-more">${pendingImages.length}/6</span>`:'')}
function clearImage(){pendingImages=[];pendingImage=null;const input=$('imageInput');if(input)input.value='';showPendingImages()}
function fitChatImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('图片读取失败'));reader.onload=()=>{const image=new Image();image.onerror=()=>resolve(reader.result);image.onload=()=>{const max=1440;const scale=Math.min(1,max/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);let q=.84,data=canvas.toDataURL('image/jpeg',q);while(data.length>850000&&q>.55){q-=.08;data=canvas.toDataURL('image/jpeg',q)}resolve(data)};image.src=reader.result};reader.readAsDataURL(file)})}
async function acceptChatPhotos(files){const available=6-pendingImages.length;if(!available){toast('一次最多发送 6 张图片','error');return}const picked=Array.from(files).filter(f=>f.type.startsWith('image/')).slice(0,available);if(!picked.length)return;try{const compressed=[];for(const file of picked)compressed.push(await fitChatImage(file));pendingImages.push(...compressed);showPendingImages();if(files.length>available)toast('一次最多发送 6 张，已保留前面的图片')}catch(e){toast('图片处理失败：'+e.message,'error')}}
async function sendUserBubble(){if(savingBubble)return;const input=$('chatInput'),text=input.value.trim(),photos=pendingImages.slice();if(!text&&!photos.length)return toast('先写点什么吧');if(!current){await ensureConversation();return}savingBubble=true;$('sendBtn').disabled=true;const conversationId=current.id,groupId=pendingTurnGroupId||`turn-${Date.now()}`,tempId=`temp-${Date.now()}`;pendingTurnGroupId=groupId;const temp={id:tempId,replyGroupId:groupId,conversationId,role:'iris',content:text,image:photos[0]||null,images:photos,createdAt:new Date().toISOString()};resetComposerInput();clearImage();messages.push(temp);renderMessages();scrollBottom();try{const saved=await api('/api/chat/messages',{method:'POST',body:JSON.stringify({conversationId,content:text,image:photos[0]||null,images:photos,replyGroupId:groupId})});const persistedImages=chatImages(saved);const merged={...saved,image:saved.image||photos[0]||null,images:persistedImages.length>1?persistedImages:photos};const index=messages.findIndex(m=>m.id===tempId);if(index>=0)messages[index]=merged;else if(!messages.some(m=>m.id===merged.id))messages.push(merged);renderMessages();await refreshConversationMeta()}catch(e){messages=messages.filter(m=>m.id!==tempId);if(!messages.some(m=>m.role==='iris'&&m.replyGroupId===groupId))pendingTurnGroupId='';input.value=text;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,96)+'px';pendingImages=photos;showPendingImages();renderMessages();toast('发送失败：'+e.message,'error')}finally{savingBubble=false;$('sendBtn').disabled=false;updateReplyButton();scrollBottom()}}
function setupPhotoViewer(){if($('photoViewer'))return;document.body.insertAdjacentHTML('beforeend','<div class="photo-viewer" id="photoViewer" aria-hidden="true"><button class="photo-viewer-close" aria-label="关闭">×</button><button class="photo-viewer-prev" aria-label="上一张">‹</button><img id="photoViewerImage" alt="聊天图片"><button class="photo-viewer-next" aria-label="下一张">›</button><span class="photo-viewer-count" id="photoViewerCount"></span></div>');let gallery=[],index=0;const viewer=$('photoViewer'),previous=viewer.querySelector('.photo-viewer-prev'),next=viewer.querySelector('.photo-viewer-next');const draw=()=>{const image=$('photoViewerImage');image.src=gallery[index]||'';$('photoViewerCount').textContent=`${index+1} / ${gallery.length}`;previous.disabled=next.disabled=gallery.length<2};const close=()=>{viewer.classList.remove('open');viewer.setAttribute('aria-hidden','true')};viewer.querySelector('.photo-viewer-close').onclick=close;previous.onclick=()=>{index=(index-1+gallery.length)%gallery.length;draw()};next.onclick=()=>{index=(index+1)%gallery.length;draw()};viewer.onclick=e=>{if(e.target===viewer)close()};document.addEventListener('click',e=>{const trigger=e.target.closest('[data-photo-images]');if(!trigger)return;try{gallery=JSON.parse(decodeURIComponent(trigger.dataset.photoImages));index=0;draw();viewer.classList.add('open');viewer.setAttribute('aria-hidden','false')}catch(_){}})}
function enhancePhotoChat(){injectPhotoStackStyles();setupPhotoViewer();const input=$('imageInput');if(input){input.multiple=true;input.onchange=async e=>{await acceptChatPhotos(e.target.files);e.target.value=''}}$('addImage').onclick=()=>input.click();$('removeImage').onclick=clearImage;$('imagePreview').onclick=e=>{const button=e.target.closest('[data-remove-photo]');if(!button)return;pendingImages.splice(Number(button.dataset.removePhoto),1);showPendingImages()};$('sendBtn').onclick=sendUserBubble;renderMessages()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhancePhotoChat);else enhancePhotoChat();

// Multi-photo chat cards V2.  A photo group is deliberately rendered from the
// saved images array every time a room is opened, so a re-entered conversation
// uses the same grouped presentation as the just-sent optimistic message.
function photoMessageId(message){return String(message&&message.id||'')}
function photoImagesForMessage(messageId){const message=messages.find(item=>String(item.id)===String(messageId));return chatImages(message||{})}
function photoCardMarkup(src,index,count,messageId,extraClass){return '<button type="button" class="chat-photo-card '+(extraClass||'')+'" data-photo-open-v2 data-photo-message-id="'+esc(messageId)+'" data-photo-index="'+index+'" style="--photo-offset:'+(index*8)+'px;--photo-layer:'+(count-index)+'" aria-label="查看第 '+(index+1)+' 张图片"><img src="'+esc(src)+'" alt="图片 '+(index+1)+'"></button>'}
function photoStackMarkupV2(message){
  const images=chatImages(message);
  if(!images.length)return '';
  const messageId=photoMessageId(message);
  if(images.length===1)return '<button type="button" class="chat-photo-single chat-photo-single-v2" data-photo-open-v2 data-photo-message-id="'+esc(messageId)+'" data-photo-index="0" aria-label="查看图片"><img src="'+esc(images[0])+'" alt="发送的图片"></button>';
  const cards=images.map((src,index)=>photoCardMarkup(src,index,images.length,messageId,'chat-photo-stack-card')).join('');
  const expanded=images.map((src,index)=>'<button type="button" class="chat-photo-expanded-item" data-photo-open-v2 data-photo-message-id="'+esc(messageId)+'" data-photo-index="'+index+'" aria-label="查看第 '+(index+1)+' 张图片"><img src="'+esc(src)+'" alt="图片 '+(index+1)+'"><span>'+ (index+1)+' / '+images.length+'</span></button>').join('');
  const stageWidth=200+(images.length-1)*8;
  return '<section class="chat-photo-group" data-photo-group data-photo-message-id="'+esc(messageId)+'" data-photo-index="0" data-expanded="false"><div class="chat-photo-stack-shell"><div class="chat-photo-stack-stage" style="--photo-stack-width:'+stageWidth+'px" aria-label="'+images.length+' 张图片，可左右滑动切换">'+cards+'</div></div><button type="button" class="chat-photo-group-toggle" data-photo-toggle aria-expanded="false">展开 '+images.length+'</button><div class="chat-photo-expanded-list">'+expanded+'</div></section>';
}
messageContent=function(message){const photos=photoStackMarkupV2(message);const bubble=message.content?'<div class="bubble">'+esc(message.content)+'</div>':'';return photos+bubble}
renderGroup=function(group,role){const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',bubbles='<div class="bubble-stack">'+group.messages.map(messageContent).join('')+'</div>';return '<div class="message-group '+(user?'user':'assistant')+'">'+(user?bubbles+person:person+bubbles)+'</div>'}

function injectPhotoStackV2Styles(){
  if($('chatPhotoStackV2Styles'))return;
  const css=[
    '.chat-photo-single-v2{appearance:none;border:0;background:none;padding:0;display:block;cursor:pointer;position:relative;margin:0 0 8px;max-width:min(220px,60vw)}',
    '.chat-photo-single-v2 img{display:block;width:min(220px,60vw);max-height:250px;object-fit:cover;border-radius:15px;border:1px solid var(--chat-border)}',
    '.chat-photo-group{position:relative;isolation:isolate;display:grid;grid-template-columns:max-content max-content;align-items:center;gap:0 9px;width:max-content;max-width:100%;margin:0 0 10px;flex:none}',
    '.assistant .chat-photo-group,.assistant .chat-photo-single-v2{margin-left:0}.user .chat-photo-group,.user .chat-photo-single-v2{margin-left:auto}.user .chat-photo-group-toggle{grid-column:1;grid-row:1}.user .chat-photo-stack-shell{grid-column:2;grid-row:1}',
    '.chat-photo-stack-shell{min-width:0}.chat-photo-stack-stage{position:relative;width:min(var(--photo-stack-width),66vw);height:min(218px,58vw);min-height:156px;touch-action:pan-y;user-select:none;-webkit-user-select:none}',
    '.chat-photo-card{appearance:none;position:absolute!important;inset:auto!important;top:0!important;left:0!important;width:min(200px,52vw)!important;height:100%!important;overflow:hidden;padding:0;border-radius:15px;border:1px solid rgba(78,57,39,.18);box-shadow:0 5px 14px rgba(73,53,38,.16);background:#eee;transform:translateX(var(--photo-offset,0px))!important;z-index:var(--photo-layer,1);transition:transform .22s ease,box-shadow .22s ease;cursor:pointer}',
    '.chat-photo-card img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}.chat-photo-card[data-photo-active="true"]{box-shadow:0 7px 17px rgba(73,53,38,.21)}',
    '.chat-photo-group-toggle{appearance:none;border:0;border-radius:999px;padding:7px 10px;background:color-mix(in srgb,var(--chat-surface) 90%,var(--chat-border));color:var(--chat-muted);font:400 13px var(--font-b);white-space:nowrap;cursor:pointer}.chat-photo-group-toggle:active{transform:scale(.97)}',
    '.chat-photo-expanded-list{display:none;flex-direction:column;gap:9px;width:min(230px,64vw)}.chat-photo-expanded-item{position:relative;display:block;width:100%;height:min(230px,62vw);padding:0;overflow:hidden;border:1px solid var(--chat-border);border-radius:15px;background:#eee;box-shadow:var(--shadow-xs);cursor:pointer}.chat-photo-expanded-item img{display:block;width:100%;height:100%;object-fit:cover}.chat-photo-expanded-item span{position:absolute;right:8px;bottom:8px;border-radius:999px;padding:3px 7px;background:rgba(42,34,28,.62);color:#fff;font-size:11px}',
    '.chat-photo-group[data-expanded="true"]{display:flex;flex-direction:column;align-items:flex-start;gap:8px;width:min(230px,64vw)}.user .chat-photo-group[data-expanded="true"]{align-items:flex-end}.chat-photo-group[data-expanded="true"] .chat-photo-stack-shell{display:none}.chat-photo-group[data-expanded="true"] .chat-photo-expanded-list{display:flex}.chat-photo-group[data-expanded="true"] .chat-photo-group-toggle{align-self:flex-start}.user .chat-photo-group[data-expanded="true"] .chat-photo-group-toggle{align-self:flex-end}',
    '@media(max-width:540px){.chat-photo-group{gap:0 7px}.chat-photo-group-toggle{padding:6px 9px;font-size:12px}}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="chatPhotoStackV2Styles">'+css+'</style>');
}
function setPhotoGroupIndex(group,nextIndex){
  if(!group)return;
  const cards=Array.from(group.querySelectorAll('.chat-photo-stack-card'));
  const count=cards.length;
  if(!count)return;
  const active=((Number(nextIndex)%count)+count)%count;
  group.dataset.photoIndex=String(active);
  cards.forEach(card=>{
    const itemIndex=Number(card.dataset.photoIndex);
    const position=(itemIndex-active+count)%count;
    card.style.setProperty('--photo-offset',(position*8)+'px');
    card.style.setProperty('--photo-layer',String(count-position));
    card.dataset.photoActive=String(position===0);
  });
}
function setPhotoGroupExpanded(group,expanded){
  if(!group)return;
  group.dataset.expanded=String(expanded);
  const button=group.querySelector('[data-photo-toggle]');
  const count=group.querySelectorAll('.chat-photo-expanded-item').length;
  if(button){button.textContent=expanded?'收起':'展开 '+count;button.setAttribute('aria-expanded',String(expanded))}
}
let photoViewerV2Images=[],photoViewerV2Index=0;
function drawPhotoViewerV2(){
  const viewer=$('photoViewer');
  if(!viewer)return;
  const image=$('photoViewerImage'),previous=viewer.querySelector('.photo-viewer-prev'),next=viewer.querySelector('.photo-viewer-next');
  image.src=photoViewerV2Images[photoViewerV2Index]||'';
  $('photoViewerCount').textContent=(photoViewerV2Index+1)+' / '+photoViewerV2Images.length;
  previous.disabled=next.disabled=photoViewerV2Images.length<2;
}
function openPhotoViewerV2(images,index){
  if(!images.length)return;
  setupPhotoViewerV2Controls();
  photoViewerV2Images=images;
  photoViewerV2Index=Math.min(Math.max(0,Number(index)||0),images.length-1);
  const viewer=$('photoViewer');
  drawPhotoViewerV2();
  viewer.classList.add('open');
  viewer.setAttribute('aria-hidden','false');
}
function setupPhotoViewerV2Controls(){
  setupPhotoViewer();
  const viewer=$('photoViewer');
  if(!viewer||viewer.dataset.photoStackV2Controls)return;
  viewer.dataset.photoStackV2Controls='true';
  const close=()=>{viewer.classList.remove('open');viewer.setAttribute('aria-hidden','true')};
  viewer.querySelector('.photo-viewer-close').onclick=close;
  viewer.querySelector('.photo-viewer-prev').onclick=()=>{if(photoViewerV2Images.length){photoViewerV2Index=(photoViewerV2Index-1+photoViewerV2Images.length)%photoViewerV2Images.length;drawPhotoViewerV2()}};
  viewer.querySelector('.photo-viewer-next').onclick=()=>{if(photoViewerV2Images.length){photoViewerV2Index=(photoViewerV2Index+1)%photoViewerV2Images.length;drawPhotoViewerV2()}};
  viewer.onclick=event=>{if(event.target===viewer)close()};
}
function setupPhotoInteractionsV2(){
  if(document.documentElement.dataset.photoStackV2Ready)return;
  document.documentElement.dataset.photoStackV2Ready='true';
  let gesture=null;
  document.addEventListener('click',event=>{
    const toggle=event.target.closest('[data-photo-toggle]');
    if(toggle){event.preventDefault();event.stopPropagation();const group=toggle.closest('[data-photo-group]');setPhotoGroupExpanded(group,group.dataset.expanded!=='true');return}
    const opener=event.target.closest('[data-photo-open-v2]');
    if(!opener)return;
    const group=opener.closest('[data-photo-group]');
    if(group&&Number(group.dataset.photoSuppressUntil||0)>Date.now())return;
    const images=photoImagesForMessage(opener.dataset.photoMessageId);
    openPhotoViewerV2(images,opener.dataset.photoIndex);
  });
  document.addEventListener('pointerdown',event=>{
    const stage=event.target.closest('.chat-photo-stack-stage');
    if(!stage||event.button>0)return;
    const group=stage.closest('[data-photo-group]');
    if(!group||group.dataset.expanded==='true')return;
    gesture={stage,group,pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    if(stage.setPointerCapture)stage.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointerup',event=>{
    if(!gesture||gesture.pointerId!==event.pointerId)return;
    const currentGesture=gesture;
    gesture=null;
    const dx=event.clientX-currentGesture.x,dy=event.clientY-currentGesture.y;
    if(Math.abs(dx)<34||Math.abs(dx)<=Math.abs(dy))return;
    event.preventDefault();
    currentGesture.group.dataset.photoSuppressUntil=String(Date.now()+350);
    const direction=dx<0?1:-1;
    setPhotoGroupIndex(currentGesture.group,Number(currentGesture.group.dataset.photoIndex||0)+direction);
  });
  document.addEventListener('pointercancel',()=>{gesture=null});
}
function enhancePhotoStackV2(){
  injectPhotoStackV2Styles();
  setupPhotoViewerV2Controls();
  setupPhotoInteractionsV2();
  renderMessages();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhancePhotoStackV2);else enhancePhotoStackV2();

// Conversation tools V3: room-level storage controls and WeChat-style
// long-press message actions.  The server remains the source of truth, so
// edits, recalls, translations and regenerated replies survive re-entry.
let pendingQuoteV3=null;
let messageActionIdV3='';
let messageSelectionV3=new Set();
let messageSelectingV3=false;
function messageByIdV3(id){return messages.find(message=>String(message.id)===String(id))}
function messageImagesNoticeV3(message){
  if(!message.imageStatus)return '';
  return '<div class="chat-photo-expired">'+(message.imageStatus==='cleared'?'图片已清理':'图片已过期')+'</div>';
}
function messageQuoteMarkupV3(message){
  if(!message.quote)return '';
  const text=String(message.quote.content||'[图片]').replace(/\s+/g,' ').trim();
  return '<div class="message-quote"><span>回复</span><p>'+esc(text.slice(0,88))+'</p></div>';
}
function messageContentV3(message){
  const messageId=esc(String(message.id||''));
  if(message.recalled)return '<article class="chat-message-item recalled-item" data-message-id="'+messageId+'"><div class="chat-message-recalled">Rei 撤回了一条消息</div></article>';
  const photos=chatImages(message).length?photoStackMarkupV2(message):messageImagesNoticeV3(message);
  const quote=messageQuoteMarkupV3(message);
  const bubble=message.content?'<div class="bubble" data-message-bubble>'+esc(message.content)+(message.editedAt?'<small class="message-edited">已编辑</small>':'')+'</div>':'';
  const translation=message.translation&&message.translation.text?'<div class="message-translation"><span>中文翻译</span><p>'+esc(message.translation.text)+'</p></div>':'';
  return '<article class="chat-message-item" data-message-id="'+messageId+'">'+quote+photos+bubble+translation+'</article>';
}
messageContent=messageContentV3;
renderGroup=function(group,role){
  const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt);
  const person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>';
  const bubbles='<div class="bubble-stack">'+group.messages.map(messageContent).join('')+'</div>';
  return '<div class="message-group '+(user?'user':'assistant')+'">'+(user?bubbles+person:person+bubbles)+'</div>';
};
const renderMessagesV3Base=renderMessages;
renderMessages=function(){renderMessagesV3Base();syncMessageSelectionV3()};

function injectConversationToolsV3Styles(){
  if($('conversationToolsV3Styles'))return;
  const css=[
    '.chat-message-item{position:relative;display:block;min-width:0}.chat-message-item .bubble{position:relative}.message-edited{display:block;margin-top:4px;color:var(--chat-muted);font-size:10px;font-weight:400}.message-quote{max-width:100%;margin:0 0 6px;padding:7px 10px;border-left:3px solid var(--chat-accent);border-radius:0 9px 9px 0;background:color-mix(in srgb,var(--chat-surface) 84%,var(--chat-border));color:var(--chat-muted);font-size:11px}.message-quote span{display:block;margin-bottom:2px;font-size:10px;color:var(--chat-accent)}.message-quote p,.message-translation p{margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.message-translation{max-width:100%;margin-top:6px;padding:8px 10px;border:1px solid var(--chat-border);border-radius:10px;background:color-mix(in srgb,var(--chat-surface) 92%,var(--chat-user-bubble));color:var(--chat-muted);font-size:12px;line-height:1.55}.message-translation span{display:block;margin-bottom:2px;color:var(--chat-accent);font-size:10px}.chat-photo-expired{display:flex;align-items:center;justify-content:center;width:min(200px,52vw);height:min(118px,32vw);margin:0 0 8px;border:1px dashed var(--chat-border);border-radius:14px;background:color-mix(in srgb,var(--chat-surface) 86%,var(--chat-border));color:var(--chat-muted);font-size:12px}.user .chat-photo-expired{margin-left:auto}.chat-message-recalled{width:fit-content;max-width:100%;padding:8px 11px;border-radius:11px;background:color-mix(in srgb,var(--chat-surface) 78%,var(--chat-border));color:var(--chat-muted);font-size:12px}.user .chat-message-recalled{margin-left:auto}',
    '.message-action-menu{position:fixed;z-index:600;display:none;width:min(300px,calc(100vw - 28px));padding:8px;border:1px solid color-mix(in srgb,var(--chat-border) 90%,transparent);border-radius:16px;background:color-mix(in srgb,var(--chat-surface) 97%,#000 3%);box-shadow:var(--shadow-md);backdrop-filter:blur(18px)}.message-action-menu.open{display:block}.message-action-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.message-action-grid button{min-height:56px;border:0;border-radius:11px;background:transparent;color:var(--chat-text);font:13px var(--font-b);cursor:pointer}.message-action-grid button:hover,.message-action-grid button:active{background:var(--accent-pale)}.message-action-grid .danger{color:var(--chat-accent)}',
    '.message-selecting .chat-message-item{padding-left:31px}.message-selecting .chat-message-item:before{content:"";position:absolute;left:3px;top:50%;width:19px;height:19px;border:1.5px solid var(--chat-border);border-radius:50%;background:var(--chat-surface);transform:translateY(-50%);z-index:5}.message-selecting .chat-message-item.selected:before{content:"✓";display:grid;place-items:center;border-color:var(--chat-accent);background:var(--chat-accent);color:var(--accent-contrast);font-size:13px}.message-multi-bar{position:fixed;left:14px;right:14px;bottom:calc(134px + env(safe-area-inset-bottom));z-index:500;display:none;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--chat-border);border-radius:14px;background:var(--chat-surface);box-shadow:var(--shadow-md)}.message-multi-bar.open{display:flex}.message-multi-count{flex:1;color:var(--chat-muted);font-size:12px}.message-multi-bar button{border:0;border-radius:9px;padding:8px 10px;background:var(--accent-pale);color:var(--chat-accent);font:12px var(--font-b);cursor:pointer}.message-multi-bar .danger{background:#fff0f0;color:#a54c4c}',
    '.composer-quote-preview{display:none;max-width:820px;margin:0 auto 7px;padding:8px 10px;border-left:3px solid var(--chat-accent);border-radius:0 11px 11px 0;background:var(--chat-surface);box-shadow:var(--shadow-xs);color:var(--chat-muted);font-size:12px}.composer-quote-preview.show{display:flex;align-items:center;gap:8px}.composer-quote-preview p{flex:1;min-width:0;margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.composer-quote-preview button{width:24px;height:24px;border:0;border-radius:50%;background:transparent;color:var(--chat-muted);font-size:18px;cursor:pointer}',
    '.room-storage-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.room-storage-actions button{min-height:38px;border:1px solid var(--chat-border);border-radius:10px;background:var(--chat-surface);color:var(--chat-text);font:12px var(--font-b);cursor:pointer}.room-storage-actions .danger{border-color:#efc4c4;background:#fff7f7;color:#a54c4c}.storage-note{margin:9px 0 0;color:var(--chat-muted);font-size:11px;line-height:1.5}',
    '@media(max-width:540px){.message-action-menu{width:min(284px,calc(100vw - 24px))}.message-action-grid button{min-height:51px;font-size:12px}.message-multi-bar{bottom:calc(130px + env(safe-area-inset-bottom))}}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="conversationToolsV3Styles">'+css+'</style>');
}
function ensureConversationToolsUiV3(){
  if(!$('messageActionMenu')){
    document.body.insertAdjacentHTML('beforeend','<section class="message-action-menu" id="messageActionMenu" aria-hidden="true"><div class="message-action-grid" id="messageActionGrid"></div></section><div class="message-multi-bar" id="messageMultiBar"><span class="message-multi-count" id="messageMultiCount">已选择 0 条</span><button type="button" id="messageMultiCancel">取消</button><button type="button" class="danger" id="messageMultiDelete">删除</button></div>');
    $('messageActionGrid').onclick=event=>{const button=event.target.closest('[data-message-action]');if(button)runMessageActionV3(button.dataset.messageAction,messageActionIdV3)};
    $('messageMultiCancel').onclick=()=>endMessageSelectionV3();
    $('messageMultiDelete').onclick=deleteSelectedMessagesV3;
  }
  if(!$('composerQuotePreview')){
    $('imagePreview').insertAdjacentHTML('beforebegin','<div class="composer-quote-preview" id="composerQuotePreview"><p id="composerQuoteText"></p><button type="button" id="composerQuoteClose" aria-label="取消引用">×</button></div>');
    $('composerQuoteClose').onclick=clearPendingQuoteV3;
  }
}
function syncMessageSelectionV3(){
  const root=$('messages');
  if(!root)return;
  root.classList.toggle('message-selecting',messageSelectingV3);
  root.querySelectorAll('.chat-message-item').forEach(item=>item.classList.toggle('selected',messageSelectionV3.has(String(item.dataset.messageId))));
  const bar=$('messageMultiBar'),count=$('messageMultiCount');
  if(bar)bar.classList.toggle('open',messageSelectingV3);
  if(count)count.textContent='已选择 '+messageSelectionV3.size+' 条';
}
function isForeignMessageV3(message){
  const text=String(message&&message.content||'');
  return /[A-Za-z\u00c0-\u024f\u0400-\u04ff\u3040-\u30ff\uac00-\ud7af]/.test(text);
}
function canRegenerateMessageV3(message){
  if(!message||message.role!=='iris')return false;
  const turnIds=[...new Set(messages.filter(item=>item.role==='iris').map(item=>String(item.replyGroupId||item.id)))];
  return turnIds.at(-1)===String(message.replyGroupId||message.id);
}
function showMessageActionsV3(messageId,anchor){
  const message=messageByIdV3(messageId);
  if(!message||message.recalled)return;
  ensureConversationToolsUiV3();
  const actions=[['quote','引用回复'],['copy','复制'],['edit','编辑'],['delete','删除'],['select','多选']];
  if(isForeignMessageV3(message))actions.splice(2,0,['translate','翻译']);
  if(message.role==='iris'&&canRegenerateMessageV3(message))actions.push(['regenerate','重新生成']);
  if(message.role==='iris')actions.push(['recall','撤回']);
  const menu=$('messageActionMenu');
  $('messageActionGrid').innerHTML=actions.map(action=>'<button type="button" class="'+(action[0]==='delete'||action[0]==='recall'?'danger':'')+'" data-message-action="'+action[0]+'">'+action[1]+'</button>').join('');
  messageActionIdV3=String(messageId);
  const rect=anchor.getBoundingClientRect(),menuWidth=Math.min(300,innerWidth-28);
  menu.style.left=Math.max(14,Math.min(rect.left,innerWidth-menuWidth-14))+'px';
  menu.style.top=Math.max(104,Math.min(rect.top-10,innerHeight-235))+'px';
  menu.classList.add('open');
  menu.setAttribute('aria-hidden','false');
}
function hideMessageActionsV3(){
  const menu=$('messageActionMenu');
  if(menu){menu.classList.remove('open');menu.setAttribute('aria-hidden','true')}
  messageActionIdV3='';
}
function showPendingQuoteV3(message){
  pendingQuoteV3={id:message.id,role:message.role,content:String(message.content||'[图片]').slice(0,280)};
  const box=$('composerQuotePreview');
  $('composerQuoteText').textContent='引用：'+pendingQuoteV3.content;
  box.classList.add('show');
  $('chatInput').focus();
}
function clearPendingQuoteV3(){
  pendingQuoteV3=null;
  const box=$('composerQuotePreview');
  if(box)box.classList.remove('show');
}
function beginMessageSelectionV3(messageId){
  messageSelectingV3=true;
  messageSelectionV3=new Set([String(messageId)]);
  hideMessageActionsV3();
  syncMessageSelectionV3();
}
function endMessageSelectionV3(){
  messageSelectingV3=false;
  messageSelectionV3.clear();
  syncMessageSelectionV3();
}
async function deleteSelectedMessagesV3(){
  if(!messageSelectionV3.size)return;
  if(!confirm('删除选中的 '+messageSelectionV3.size+' 条消息？此操作不能撤销。'))return;
  try{
    await api('/api/chat/messages/batch-delete',{method:'POST',body:JSON.stringify({ids:[...messageSelectionV3]})});
    messages=messages.filter(message=>!messageSelectionV3.has(String(message.id)));
    endMessageSelectionV3();
    renderMessages();
    toast('已删除','success');
  }catch(error){toast('删除失败：'+error.message,'error')}
}
async function reloadRoomMessagesV3(){
  if(!current)return;
  const data=await api('/api/chat/messages?conversationId='+encodeURIComponent(current.id)+'&limit=100');
  messages=data.messages||[];
  pendingTurnGroupId=getPendingTurnGroupId(messages);
  renderMessages();
}
async function runMessageActionV3(action,messageId){
  const message=messageByIdV3(messageId);
  if(!message)return hideMessageActionsV3();
  hideMessageActionsV3();
  try{
    if(action==='quote'){showPendingQuoteV3(message);return}
    if(action==='copy'){
      const text=String(message.content||'').trim();
      if(!text){toast('这条图片消息没有可复制的文字');return}
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{const input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();document.execCommand('copy');input.remove()}
      toast('已复制','success');
      return;
    }
    if(action==='select'){beginMessageSelectionV3(message.id);return}
    if(action==='edit'){
      const next=prompt('编辑消息',message.content||'');
      if(next===null)return;
      const saved=await api('/api/chat/messages/'+encodeURIComponent(message.id),{method:'PUT',body:JSON.stringify({content:next})});
      const index=messages.findIndex(item=>item.id===message.id);
      if(index>=0)messages[index]=saved;
      renderMessages();
      toast('已保存','success');
      return;
    }
    if(action==='delete'){
      if(!confirm('删除这条消息？此操作不能撤销。'))return;
      await api('/api/chat/messages/'+encodeURIComponent(message.id),{method:'DELETE'});
      messages=messages.filter(item=>item.id!==message.id);
      renderMessages();
      toast('已删除','success');
      return;
    }
    if(action==='translate'){
      const saved=await api('/api/chat/messages/'+encodeURIComponent(message.id)+'/translate',{method:'POST'});
      const index=messages.findIndex(item=>item.id===message.id);
      if(index>=0)messages[index]=saved;
      renderMessages();
      return;
    }
    if(action==='recall'){
      if(!confirm('撤回这条消息？撤回后不会再作为后续上下文。'))return;
      const saved=await api('/api/chat/messages/'+encodeURIComponent(message.id)+'/recall',{method:'POST'});
      const index=messages.findIndex(item=>item.id===message.id);
      if(index>=0)messages[index]=saved;
      renderMessages();
      toast('已撤回','success');
      return;
    }
    if(action==='regenerate'){
      if(!confirm('重新生成这一轮回复？现有的 AI 回复会被新回复替换。'))return;
      if(sending||replyLoadingV20)return;
      const previousMessages=messages.slice();
      const targetGroupId=String(message.replyGroupId||message.id);
      const targetMessages=messages.filter(item=>item.role==='iris'&&String(item.replyGroupId||item.id)===targetGroupId);
      let oldReplies=messages.filter(item=>item.role!=='iris'&&item.role!=='system'&&String(item.inReplyToGroupId||'')===targetGroupId);
      if(!oldReplies.length){
        const lastTargetIndex=messages.reduce((index,item,currentIndex)=>targetMessages.includes(item)?currentIndex:index,-1);
        oldReplies=messages.slice(lastTargetIndex+1).filter(item=>item.role!=='iris'&&item.role!=='system');
      }
      const oldReplyIds=new Set(oldReplies.map(item=>String(item.id)));
      messages=messages.filter(item=>!oldReplyIds.has(String(item.id)));
      sending=true;
      replyLoadingV20={conversationId:current?.id||''};
      updateReplyButton();
      renderMessages();
      scrollBottom();
      try{
        const data=await api('/api/chat/messages/'+encodeURIComponent(message.id)+'/regenerate',{method:'POST'});
        const aiMessages=Array.isArray(data.aiMessages)?data.aiMessages:[];
        const aiIds=new Set(aiMessages.map(item=>String(item.id)));
        const base=(Array.isArray(data.messages)?data.messages:messages).filter(item=>!aiIds.has(String(item.id)));
        replyLoadingV20=null;
        await revealAiMessagesV20(aiMessages,base);
        pendingTurnGroupId=getPendingTurnGroupId(messages);
        await refreshConversationMeta();
        toast('已生成新回复','success');
      }catch(error){
        messages=previousMessages;
        pendingTurnGroupId=getPendingTurnGroupId(messages);
        throw error;
      }finally{
        replyLoadingV20=null;
        sending=false;
        updateReplyButton();
        renderMessages();
        scrollBottom();
      }
    }
  }catch(error){toast((action==='translate'?'翻译':action==='regenerate'?'重新生成':'操作')+'失败：'+error.message,'error')}
}
function setupMessageLongPressV3(){
  if(document.documentElement.dataset.messageToolsV3Ready)return;
  document.documentElement.dataset.messageToolsV3Ready='true';
  let hold=null;
  const cancelHold=()=>{if(hold){clearTimeout(hold.timer);hold=null}};
  document.addEventListener('pointerdown',event=>{
    if(event.button>0||messageSelectingV3)return;
    const item=event.target.closest('.chat-message-item');
    if(!item||event.target.closest('#messageActionMenu'))return;
    hold={item,pointerId:event.pointerId,x:event.clientX,y:event.clientY,timer:setTimeout(()=>{if(!hold)return;showMessageActionsV3(item.dataset.messageId,item);if(navigator.vibrate)navigator.vibrate(12);hold=null},520)};
  });
  document.addEventListener('pointermove',event=>{if(hold&&hold.pointerId===event.pointerId&&(Math.abs(event.clientX-hold.x)>12||Math.abs(event.clientY-hold.y)>12))cancelHold()});
  document.addEventListener('pointerup',cancelHold);
  document.addEventListener('pointercancel',cancelHold);
  document.addEventListener('contextmenu',event=>{const item=event.target.closest('.chat-message-item');if(item){event.preventDefault();showMessageActionsV3(item.dataset.messageId,item)}});
  document.addEventListener('click',event=>{
    if(messageSelectingV3){
      const item=event.target.closest('.chat-message-item');
      if(item&&!event.target.closest('#messageMultiBar')){event.preventDefault();event.stopPropagation();const id=String(item.dataset.messageId);if(messageSelectionV3.has(id))messageSelectionV3.delete(id);else messageSelectionV3.add(id);syncMessageSelectionV3();return}
    }
    if(!event.target.closest('#messageActionMenu')&&!event.target.closest('.chat-message-item'))hideMessageActionsV3();
  },true);
}
async function sendUserBubbleV3(){
  if(savingBubble)return;
  const input=$('chatInput'),text=input.value.trim(),photos=pendingImages.slice(),quote=pendingQuoteV3?{...pendingQuoteV3}:null;
  if(!text&&!photos.length)return toast('先写点什么吧');
  if(!current){await ensureConversation();return}
  savingBubble=true;$('sendBtn').disabled=true;
  const conversationId=current.id,groupId=pendingTurnGroupId||'turn-'+Date.now(),tempId='temp-'+Date.now();
  pendingTurnGroupId=groupId;
  const temp={id:tempId,replyGroupId:groupId,conversationId,role:'iris',content:text,image:photos[0]||null,images:photos,quote,createdAt:new Date().toISOString()};
  resetComposerInput();clearImage();clearPendingQuoteV3();messages.push(temp);renderMessages();scrollBottom();
  try{
    const saved=await api('/api/chat/messages',{method:'POST',body:JSON.stringify({conversationId,content:text,image:photos[0]||null,images:photos,quote,replyGroupId:groupId})});
    const persistedImages=chatImages(saved);
    const merged={...saved,image:saved.image||photos[0]||null,images:persistedImages.length>1?persistedImages:photos};
    const index=messages.findIndex(message=>message.id===tempId);
    if(index>=0)messages[index]=merged;else if(!messages.some(message=>message.id===merged.id))messages.push(merged);
    renderMessages();await refreshConversationMeta();
  }catch(error){
    messages=messages.filter(message=>message.id!==tempId);
    if(!messages.some(message=>message.role==='iris'&&message.replyGroupId===groupId))pendingTurnGroupId='';
    input.value=text;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,96)+'px';
    pendingImages=photos;showPendingImages();if(quote)showPendingQuoteV3(quote);renderMessages();toast('发送失败：'+error.message,'error');
  }finally{savingBubble=false;$('sendBtn').disabled=false;updateReplyButton();scrollBottom()}
}
sendUserBubble=sendUserBubbleV3;
function ensureRoomStorageV3(){
  const holder=$('rightDrawer')&&$('rightDrawer').querySelector('.drawer-scroll');
  if(!holder||$('roomStorageSettings'))return;
  const note=holder.querySelector('.empty-note');
  const markup='<div class="setting-block" id="roomStorageSettings"><h3>存储管理</h3><label class="setting-row"><span>图片保留</span><select class="mini-select" id="imageRetention"><option value="5-turns">最近 5 个回合</option><option value="10-turns">最近 10 个回合</option><option value="7-days">7 天</option><option value="forever">永久保留</option></select></label><div class="room-storage-actions"><button type="button" id="clearRoomImages">清空图片</button><button type="button" class="danger" id="clearRoomMessages">清空当前聊天</button></div><p class="storage-note">清空图片会保留文字；过期图片会显示为占位，不影响已写入的记忆。</p></div>';
  if(note)note.insertAdjacentHTML('beforebegin',markup);else holder.insertAdjacentHTML('beforeend',markup);
  $('imageRetention').onchange=saveConversationSettings;
  $('clearRoomImages').onclick=async()=>{
    if(!current||!confirm('清空当前聊天里的所有图片，保留文字？'))return;
    try{const result=await api('/api/chat/conversations/'+encodeURIComponent(current.id)+'/clear-images',{method:'POST'});await reloadRoomMessagesV3();toast('已清理 '+result.removed+' 组图片','success')}catch(error){toast('清理失败：'+error.message,'error')}
  };
  $('clearRoomMessages').onclick=async()=>{
    if(!current||!confirm('清空当前房间的全部聊天记录和图片？此操作不能撤销。'))return;
    try{await api('/api/chat/conversations/'+encodeURIComponent(current.id)+'/clear-messages',{method:'POST'});messages=[];pendingTurnGroupId='';clearPendingQuoteV3();renderMessages();toast('当前聊天已清空','success')}catch(error){toast('清空失败：'+error.message,'error')}
  };
}
const hydrateRightV3Base=hydrateRight;
hydrateRight=function(){
  hydrateRightV3Base();
  ensureRoomStorageV3();
  if($('imageRetention'))$('imageRetention').value=current&&current.imageRetention||'5-turns';
};
async function saveConversationSettingsV3(){
  if(!current)return;
  const value=$('conversationModel').value,parts=value.split('::'),presetId=parts[0]||'',model=parts[1]||'';
  const appearance={avatarSize:+$('avatarSize').value,avatarRadius:+$('avatarRadius').value,bubbleWidth:+$('bubbleWidth').value,userBubble:$('userBubble').value,aiBubble:$('aiBubble').value,userBubbleText:$('userBubbleText')?.value||'',aiBubbleText:$('aiBubbleText')?.value||''};
  try{
    await updateConversation(current.id,{presetId,model,multiBubble:$('multiBubble').checked,appearance,imageRetention:$('imageRetention')?$('imageRetention').value:'5-turns'});
    applyAppearance();
    await reloadRoomMessagesV3();
  }catch(error){toast('保存设置失败：'+error.message,'error')}
}
saveConversationSettings=saveConversationSettingsV3;
function bindConversationToolsV3(){
  ensureConversationToolsUiV3();
  ['conversationModel','multiBubble','avatarSize','avatarRadius','bubbleWidth','userBubble','aiBubble'].forEach(id=>{const input=$(id);if(input)input.onchange=saveConversationSettingsV3});
  $('sendBtn').onclick=sendUserBubbleV3;
}
function enhanceConversationToolsV3(){
  injectConversationToolsV3Styles();
  ensureConversationToolsUiV3();
  ensureRoomStorageV3();
  bindConversationToolsV3();
  setupMessageLongPressV3();
  renderMessages();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceConversationToolsV3);else enhanceConversationToolsV3();

// Conversation tools V4: keep every message item aligned with its sender,
// render quotes/recalls as their own message semantics, and add translation UX.
let collapsedTranslationsV4=new Set();
function activeRoleNameV4(){return roles.find(role=>role.id===current?.roleId)?.name||'TA'}
function quoteAuthorNameV4(quote){return quote?.role==='iris'?(profile?.name||'Iris'):activeRoleNameV4()}
function messageQuoteMarkupV4(message){
  if(!message.quote)return '';
  const source=String(message.quote.content||'[图片]').replace(/\s+/g,' ').trim()||'[图片]';
  const snippet=source.length>52?source.slice(0,52)+'…':source;
  return '<div class="message-quote"><p><strong>'+esc(quoteAuthorNameV4(message.quote))+'：</strong>'+esc(snippet)+'</p></div>';
}
function translationIconV4(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M7.5 10h9M7.5 13h6"/></svg>'}
function messageTranslationMarkupV4(message){
  if(!message.translation?.text)return '';
  const id=String(message.id||''),collapsed=collapsedTranslationsV4.has(id);
  return '<button type="button" class="message-translation'+(collapsed?' is-collapsed':'')+'" data-translation-toggle="'+esc(id)+'" aria-expanded="'+(!collapsed)+'" title="'+(collapsed?'展开中文翻译':'收起中文翻译')+'"><span class="translation-icon">'+translationIconV4()+'</span>'+(collapsed?'<span class="sr-only">展开中文翻译</span>':'<p>'+esc(message.translation.text)+'</p>')+'</button>';
}
function messageContentV4(message){
  const messageId=esc(String(message.id||''));
  if(message.recalled)return '';
  const photos=chatImages(message).length?photoStackMarkupV2(message):messageImagesNoticeV3(message);
  const bubble=message.content?'<div class="bubble" data-message-bubble>'+esc(message.content)+'</div>':'';
  return '<article class="chat-message-item" data-message-id="'+messageId+'">'+photos+bubble+messageQuoteMarkupV4(message)+messageTranslationMarkupV4(message)+'</article>';
}
function recalledMessageLabelV4(message){
  const name=message.recalledBy==='iris'?(profile?.name||'Iris'):activeRoleNameV4();
  return name+' 撤回了一条消息';
}
function groupMessagesV4(list){
  const groups=[];
  for(const message of list){
    if(message.recalled){groups.push({groupId:'',role:'system',isSystem:true,messages:[message],last:message});continue}
    const previous=groups[groups.length-1],groupId=message.replyGroupId||'',sameDay=previous&&!previous.isSystem&&messageDateKey(message.createdAt)===messageDateKey(previous.last.createdAt),sameExplicit=previous&&sameDay&&groupId&&previous.groupId===groupId&&previous.role===message.role,sameLegacy=previous&&sameDay&&!groupId&&!previous.groupId&&previous.role===message.role&&Math.abs(new Date(message.createdAt)-new Date(previous.last.createdAt))<=30000;
    if((sameExplicit||sameLegacy)&&current?.mergeBubbles!==false){previous.messages.push(message);previous.last=message}else groups.push({groupId,role:message.role,messages:[message],last:message});
  }
  return groups;
}
messageContent=messageContentV4;
groupMessages=groupMessagesV4;
renderGroup=function(group,role){
  if(group.isSystem){const message=group.messages[0];return '<div class="chat-message-system" data-message-id="'+esc(String(message.id||''))+'"><span>'+esc(recalledMessageLabelV4(message))+'</span></div>'}
  const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',bubbles='<div class="bubble-stack">'+group.messages.map(messageContentV4).join('')+'</div>';
  return '<div class="message-group '+(user?'user':'assistant')+'">'+(user?bubbles+person:person+bubbles)+'</div>';
};
renderMessages=function(){renderMessagesV3Base();syncMessageSelectionV3()};
function injectConversationToolsV4Styles(){
  if($('conversationToolsV4Styles'))return;
  const css=[
    '.chat-message-item{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:6px;width:fit-content;max-width:100%;min-width:0}.message-group.user .chat-message-item{align-items:flex-end}.chat-message-item .bubble{position:relative;align-self:flex-start}.message-group.user .chat-message-item .bubble{align-self:flex-end}.message-quote{width:fit-content;max-width:100%;margin:0;padding:6px 9px;border:0;border-radius:9px;background:color-mix(in srgb,var(--chat-ai-bubble) 78%,var(--chat-border));color:var(--chat-muted);font-size:11px;line-height:1.45;box-sizing:border-box}.message-group.user .message-quote{background:color-mix(in srgb,var(--chat-user-bubble) 78%,var(--chat-border))}.message-quote p{max-width:min(248px,58vw);margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.message-quote strong{font-weight:500;color:var(--chat-accent)}',
    '.message-translation{display:flex;align-items:flex-start;gap:7px;width:fit-content;max-width:100%;margin:0;padding:8px 10px;border:0;border-radius:11px;background:color-mix(in srgb,var(--chat-ai-bubble) 70%,var(--chat-border));color:var(--chat-muted);font:12px/1.55 var(--font-b);text-align:left;cursor:pointer;box-shadow:none}.message-group.user .message-translation{background:color-mix(in srgb,var(--chat-user-bubble) 72%,var(--chat-border))}.message-translation p{max-width:min(300px,65vw);margin:0;white-space:pre-wrap;overflow:visible;text-overflow:clip}.translation-icon{width:16px;height:16px;flex:none;margin-top:1px;color:var(--chat-accent)}.translation-icon svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.message-translation.is-collapsed{width:34px;height:34px;padding:8px;align-items:center;justify-content:center;border-radius:50%}.message-translation.is-collapsed .translation-icon{margin:0}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
    '.chat-message-system{display:flex;justify-content:center;width:100%;margin:1px 0}.chat-message-system span{padding:6px 11px;border:1px solid var(--chat-border);border-radius:999px;background:color-mix(in srgb,var(--chat-surface) 84%,var(--chat-bg));color:var(--chat-muted);font-size:11px;line-height:1;box-shadow:var(--shadow-xs)}.message-selecting .chat-message-system:before{display:none}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="conversationToolsV4Styles">'+css+'</style>');
}
function toggleTranslationV4(id){if(collapsedTranslationsV4.has(id))collapsedTranslationsV4.delete(id);else collapsedTranslationsV4.add(id);renderMessages()}
function setupTranslationToggleV4(){
  if(document.documentElement.dataset.translationToggleV4Ready)return;
  document.documentElement.dataset.translationToggleV4Ready='true';
  document.addEventListener('click',event=>{const toggle=event.target.closest('[data-translation-toggle]');if(!toggle)return;event.preventDefault();event.stopPropagation();toggleTranslationV4(String(toggle.dataset.translationToggle||''))},true);
}
function ensureLanguageSettingsV4(){
  const block=$('roomStorageSettings');
  if(!block||$('autoTranslate'))return;
  block.insertAdjacentHTML('afterbegin','<label class="setting-row" id="autoTranslateRow"><span>外文自动翻译</span><input class="switch" id="autoTranslate" type="checkbox"></label>');
  $('autoTranslate').onchange=saveConversationSettingsV4;
}
const hydrateRightV4Base=hydrateRight;
hydrateRight=function(){hydrateRightV4Base();ensureLanguageSettingsV4();if($('autoTranslate'))$('autoTranslate').checked=!!current?.autoTranslate};
async function saveConversationSettingsV4(){
  if(!current)return;
  const value=$('conversationModel').value,parts=value.split('::'),presetId=parts[0]||'',model=parts[1]||'';
  const appearance={avatarSize:+$('avatarSize').value,avatarRadius:+$('avatarRadius').value,bubbleWidth:+$('bubbleWidth').value,userBubble:$('userBubble').value,aiBubble:$('aiBubble').value};
  try{await updateConversation(current.id,{presetId,model,multiBubble:$('multiBubble').checked,appearance,imageRetention:$('imageRetention')?.value||'5-turns',autoTranslate:!!$('autoTranslate')?.checked});applyAppearance();await reloadRoomMessagesV3()}catch(error){toast('保存设置失败：'+error.message,'error')}
}
saveConversationSettings=saveConversationSettingsV4;
function bindConversationToolsV4(){['conversationModel','multiBubble','avatarSize','avatarRadius','bubbleWidth','userBubble','aiBubble','imageRetention','autoTranslate'].forEach(id=>{const input=$(id);if(input)input.onchange=saveConversationSettingsV4})}
function enhanceConversationToolsV4(){injectConversationToolsV4Styles();ensureLanguageSettingsV4();bindConversationToolsV4();setupTranslationToggleV4();renderMessages()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceConversationToolsV4);else enhanceConversationToolsV4();

// Conversation tools V5: keep translation control inside the source bubble
// and refresh the open room so delayed AI actions appear without re-entering.
let expandedTranslationsV5=new Set(),roomSyncTimerV5=0,roomSyncBusyV5=false;
function messageTranslationToggleV5(message){
  if(!message.translation?.text)return '';
  const id=String(message.id||''),expanded=expandedTranslationsV5.has(id);
  return '<button type="button" class="message-translation-toggle" data-inline-translation-toggle="'+esc(id)+'" aria-expanded="'+expanded+'" title="'+(expanded?'收起中文翻译':'展开中文翻译')+'"><span class="translation-icon">'+translationIconV4()+'</span><span class="sr-only">'+(expanded?'收起中文翻译':'展开中文翻译')+'</span></button>';
}
function messageTranslationBubbleV5(message){
  if(!message.translation?.text||!expandedTranslationsV5.has(String(message.id||'')))return '';
  return '<div class="message-translation"><p>'+esc(message.translation.text)+'</p></div>';
}
function messageContentV5(message){
  const messageId=esc(String(message.id||''));
  if(message.recalled)return '';
  const photos=chatImages(message).length?photoStackMarkupV2(message):messageImagesNoticeV3(message);
  const hasTranslation=!!message.translation?.text;
  const bubble=message.content?'<div class="message-bubble-row"><div class="bubble'+(hasTranslation?' message-has-translation':'')+'" data-message-bubble>'+esc(message.content)+'</div>'+messageTranslationToggleV5(message)+'</div>':'';
  return '<article class="chat-message-item" data-message-id="'+messageId+'">'+photos+bubble+messageQuoteMarkupV4(message)+messageTranslationBubbleV5(message)+'</article>';
}
messageContent=messageContentV5;
renderGroup=function(group,role){
  if(group.isSystem){const message=group.messages[0];return '<div class="chat-message-system" data-message-id="'+esc(String(message.id||''))+'"><span>'+esc(recalledMessageLabelV4(message))+'</span></div>'}
  const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',bubbles='<div class="bubble-stack">'+group.messages.map(messageContentV5).join('')+'</div>';
  return '<div class="message-group '+(user?'user':'assistant')+'">'+(user?bubbles+person:person+bubbles)+'</div>';
};
function injectConversationToolsV5Styles(){
  if($('conversationToolsV5Styles'))return;
  const css=[
    '.bubble-stack{max-width:min(var(--bubble-width,75%),calc(100% - var(--chat-avatar-size,34px) - 38px),560px)}.message-bubble-row{position:relative;display:block;width:fit-content;max-width:100%}.message-bubble-row .bubble{margin:0}.message-bubble-row .bubble.message-has-translation{padding-right:39px}.message-group.user .message-bubble-row .bubble.message-has-translation{padding-right:14px;padding-left:39px}.message-translation-toggle{position:absolute;z-index:2;right:7px;bottom:7px;width:23px;height:23px;padding:4px;border:0;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,#fff 66%,transparent);color:#6f6560;cursor:pointer}.message-group.user .message-translation-toggle{right:auto;left:7px}.message-translation-toggle .translation-icon{width:15px;height:15px;margin:0;color:currentColor}.message-translation-toggle:active{transform:scale(.93)}',
    '.message-quote,.message-group.user .message-quote,.message-translation,.message-group.user .message-translation{background:#f1f3f3!important;color:var(--chat-muted)}.message-translation{display:block;width:fit-content;max-width:100%;margin:0;padding:8px 10px;border:0;border-radius:11px;font:12px/1.55 var(--font-b);box-shadow:none}.message-translation p{max-width:min(300px,65vw);margin:0;white-space:pre-wrap;overflow:visible;text-overflow:clip}.message-quote{max-width:100%;margin:0}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="conversationToolsV5Styles">'+css+'</style>');
}
function toggleTranslationV5(id){if(expandedTranslationsV5.has(id))expandedTranslationsV5.delete(id);else expandedTranslationsV5.add(id);renderMessages()}
function setupTranslationToggleV5(){
  if(document.documentElement.dataset.translationToggleV5Ready)return;
  document.documentElement.dataset.translationToggleV5Ready='true';
  document.addEventListener('click',event=>{const toggle=event.target.closest('[data-inline-translation-toggle]');if(!toggle)return;event.preventDefault();event.stopPropagation();toggleTranslationV5(String(toggle.dataset.inlineTranslationToggle||''))},true);
}
function roomMessageStateV5(list){return(list||[]).map(message=>[message.id,message.updatedAt,message.recalled,message.content,message.translation?.text||''].join('~')).join('|')}
async function syncOpenRoomV5(){
  if(roomSyncBusyV5||savingBubble||sending||!current||document.hidden)return;
  roomSyncBusyV5=true;
  try{
    const data=await api('/api/chat/messages?conversationId='+encodeURIComponent(current.id)+'&limit=100'),next=data.messages||[];
    if(roomMessageStateV5(next)!==roomMessageStateV5(messages)){
      const main=$('chatMain'),nearBottom=main&&main.scrollHeight-main.scrollTop-main.clientHeight<150;
      messages=next;pendingTurnGroupId=getPendingTurnGroupId(messages);renderMessages();if(nearBottom)scrollBottom();
    }
  }catch{}finally{roomSyncBusyV5=false}
}
function stopRoomSyncV5(){if(roomSyncTimerV5){clearInterval(roomSyncTimerV5);roomSyncTimerV5=0}}
function startRoomSyncV5(){stopRoomSyncV5();if(!current)return;roomSyncTimerV5=setInterval(syncOpenRoomV5,1600);syncOpenRoomV5()}
const openConversationV5Base=openConversation;
openConversation=async function(id){stopRoomSyncV5();await openConversationV5Base(id);startRoomSyncV5()};
const showLandingV5Base=showLanding;
showLanding=function(){stopRoomSyncV5();showLandingV5Base()};
function enhanceConversationToolsV5(){injectConversationToolsV5Styles();setupTranslationToggleV5();document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncOpenRoomV5()});renderMessages()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceConversationToolsV5);else enhanceConversationToolsV5();

// Conversation tools V6: keep long bubbles within the lane between the two
// avatars, and give only the first bubble in a consecutive group a speech tail.
function messageContentV6(message,index){
  const markup=messageContentV5(message);
  return index===0?markup.replace('class="chat-message-item"','class="chat-message-item is-group-first"'):markup;
}
messageContent=messageContentV6;
renderGroup=function(group,role){
  if(group.isSystem){const message=group.messages[0];return '<div class="chat-message-system" data-message-id="'+esc(String(message.id||''))+'"><span>'+esc(recalledMessageLabelV4(message))+'</span></div>'}
  const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',bubbles='<div class="bubble-stack">'+group.messages.map(messageContentV6).join('')+'</div>';
  return '<div class="message-group '+(user?'user':'assistant')+'">'+(user?bubbles+person:person+bubbles)+'</div>';
};
function injectConversationToolsV6Styles(){
  if($('conversationToolsV6Styles'))return;
  const css=[
    '.message-group{--message-avatar-gap:8px;gap:var(--message-avatar-gap);width:100%;box-sizing:border-box}.bubble-stack{max-width:calc(100% - var(--chat-avatar-size,34px) - var(--chat-avatar-size,34px) - var(--message-avatar-gap) - var(--message-avatar-gap));width:fit-content}.message-group.assistant .bubble,.message-group.user .bubble{border-bottom-left-radius:18px;border-bottom-right-radius:18px}',
    '.chat-message-item.is-group-first .bubble{position:relative}.message-group.assistant .chat-message-item.is-group-first .bubble:before,.message-group.user .chat-message-item.is-group-first .bubble:before{content:"";position:absolute;top:13px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;z-index:-1}.message-group.assistant .chat-message-item.is-group-first .bubble:before{left:-7px;border-right:8px solid var(--chat-ai-bubble)}.message-group.user .chat-message-item.is-group-first .bubble:before{right:-7px;border-left:8px solid var(--chat-user-bubble)}',
    '@media(max-width:540px){.message-group{--message-avatar-gap:8px}.bubble-stack{max-width:calc(100% - var(--chat-avatar-size,34px) - var(--chat-avatar-size,34px) - var(--message-avatar-gap) - var(--message-avatar-gap))}}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="conversationToolsV6Styles">'+css+'</style>');
}
function enhanceConversationToolsV6(){injectConversationToolsV6Styles();renderMessages()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceConversationToolsV6);else enhanceConversationToolsV6();

// Conversation tools V7: translation controls sit just outside a bubble,
// first-bubble tails inherit the bubble border, and the room header shows TA.
function renderChatHeaderV7(){
  const title=$('chatTitle');
  if(!title)return;
  if(!current){title.textContent='New chat';return}
  const role=roles.find(item=>item.id===current.roleId);
  title.innerHTML='<span class="chat-title-role-avatar" aria-hidden="true"><span class="chat-title-role-avatar-image">'+roleAvatar(role)+'</span><i class="chat-title-online-dot"></i></span><span class="chat-title-name">'+esc(current.title||role?.name||'TA')+'</span>';
}
const openConversationV7Base=openConversation;
openConversation=async function(id){await openConversationV7Base(id);renderChatHeaderV7()};
const showLandingV7Base=showLanding;
showLanding=function(){showLandingV7Base();renderChatHeaderV7()};
const refreshConversationMetaV7Base=refreshConversationMeta;
refreshConversationMeta=async function(){const result=await refreshConversationMetaV7Base();renderChatHeaderV7();return result};
function injectConversationToolsV7Styles(){
  if($('conversationToolsV7Styles'))return;
  const css=[
    '.message-bubble-row{overflow:visible}.message-bubble-row .bubble.message-has-translation,.message-group.user .message-bubble-row .bubble.message-has-translation{padding:10px 14px}.message-translation-toggle{right:-30px;bottom:6px;width:24px;height:24px;padding:4px;background:color-mix(in srgb,var(--chat-surface) 52%,transparent);border:1px solid color-mix(in srgb,var(--chat-border) 42%,transparent);box-shadow:none}.message-group.user .message-translation-toggle{right:auto;left:-30px}.message-translation-toggle:hover{background:color-mix(in srgb,var(--chat-surface) 70%,transparent)}',
    '.chat-message-item.is-group-first .bubble{z-index:0;isolation:isolate}.message-group.assistant .chat-message-item.is-group-first .bubble:before,.message-group.user .chat-message-item.is-group-first .bubble:before{top:12px;width:13px;height:13px;box-sizing:border-box;border:1px solid var(--chat-border);border-radius:2px;transform:rotate(45deg);z-index:-1}.message-group.assistant .chat-message-item.is-group-first .bubble:before{left:-7px;background:var(--chat-ai-bubble)}.message-group.user .chat-message-item.is-group-first .bubble:before{right:-7px;background:var(--chat-user-bubble)}',
    '.chat-title{display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;text-align:initial}.chat-title-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chat-title-role-avatar{position:relative;display:block;width:25px;height:25px;flex:none}.chat-title-role-avatar-image{display:grid;width:25px;height:25px;place-items:center;overflow:hidden;border:1px solid var(--chat-border);border-radius:50%;background:var(--chat-surface);color:var(--chat-accent)}.chat-title-role-avatar-image img,.chat-title-role-avatar-image svg{display:block;width:100%;height:100%;object-fit:cover}.chat-title-role-avatar-image svg{width:52%;height:52%;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.chat-title-online-dot{position:absolute;right:-1px;bottom:0;width:7px;height:7px;box-sizing:border-box;border:1.5px solid var(--chat-surface);border-radius:50%;background:#48b96b;box-shadow:0 0 0 1px color-mix(in srgb,#48b96b 26%,transparent)}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="conversationToolsV7Styles">'+css+'</style>');
}
function enhanceConversationToolsV7(){injectConversationToolsV7Styles();renderChatHeaderV7();renderMessages()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceConversationToolsV7);else enhanceConversationToolsV7();

// Conversation tools V8: return to clean round bubbles and enlarge TA in the
// compact room header.
function injectConversationToolsV8Styles(){
  if($('conversationToolsV8Styles'))return;
  const css=[
    '.message-group.assistant .chat-message-item.is-group-first .bubble:before,.message-group.user .chat-message-item.is-group-first .bubble:before{content:none}',
    '.chat-title{gap:8px}.chat-title-role-avatar,.chat-title-role-avatar-image{width:32px;height:32px}.chat-title-online-dot{right:-1px;bottom:0;width:9px;height:9px;border-width:2px}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="conversationToolsV8Styles">'+css+'</style>');
}
function enhanceConversationToolsV8(){injectConversationToolsV8Styles();renderChatHeaderV7();renderMessages()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceConversationToolsV8);else enhanceConversationToolsV8();

// AI image messages use the same viewer as user photo groups.  Add an explicit
// save control so generated images can be kept outside the VPS before retention
// cleanup removes them.
function photoSaveExtensionV9(type,source){
  const mime=String(type||'').toLowerCase();
  if(mime.includes('jpeg')||mime.includes('jpg'))return 'jpg';
  if(mime.includes('webp'))return 'webp';
  if(mime.includes('gif'))return 'gif';
  const match=String(source||'').split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return match?match[1].toLowerCase():'png';
}
function savePhotoV9(){
  const source=photoViewerV2Images[photoViewerV2Index]||$('photoViewerImage')?.currentSrc||'';
  if(!source)return;
  const button=$('photoViewerSave');
  if(button){button.disabled=true;button.textContent='正在保存…'}
  fetch(source).then(response=>{
    if(!response.ok)throw new Error('下载失败');
    return response.blob();
  }).then(blob=>{
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='iris-rei-photo-'+Date.now()+'.'+photoSaveExtensionV9(blob.type,source);
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
    toast('已开始保存图片','success');
  }).catch(()=>{
    const link=document.createElement('a');link.href=source;link.download='iris-rei-photo.jpg';link.target='_blank';document.body.appendChild(link);link.click();link.remove();
    toast('已交给浏览器保存图片','success');
  }).finally(()=>{if(button){button.disabled=false;button.textContent='保存图片'}});
}
function injectAiImageToolsV9Styles(){
  if($('aiImageToolsV9Styles'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="aiImageToolsV9Styles">.photo-viewer-save{position:absolute;right:18px;bottom:18px;border:1px solid rgba(255,255,255,.32);border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.16);color:#fff;font:500 13px var(--font-b);cursor:pointer}.photo-viewer-save:disabled{opacity:.6}.photo-viewer-save:active{transform:scale(.97)}@media(max-width:540px){.photo-viewer-save{right:14px;bottom:17px;padding:7px 10px;font-size:12px}}</style>');
}
function setupAiImageToolsV9(){
  setupPhotoViewerV2Controls();
  const viewer=$('photoViewer');
  if(!viewer||$('photoViewerSave'))return;
  viewer.insertAdjacentHTML('beforeend','<button type="button" class="photo-viewer-save" id="photoViewerSave">保存图片</button>');
  $('photoViewerSave').onclick=event=>{event.preventDefault();event.stopPropagation();savePhotoV9()};
}
function enhanceAiImageToolsV9(){injectAiImageToolsV9Styles();setupAiImageToolsV9()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceAiImageToolsV9);else enhanceAiImageToolsV9();

// Per-room image permission: when off, the image tool is not sent to TA at all.
function ensureImageGenerationSettingV10(){
  const block=$('roomStorageSettings');
  if(!block||$('imageGenerationEnabled'))return;
  const markup='<label class="setting-row" id="imageGenerationRow"><span>本房间允许 TA 主动生图<small>开启后，TA 可在合适时自行生成图片</small></span><input class="switch" id="imageGenerationEnabled" type="checkbox"></label>';
  const anchor=$('autoTranslateRow');
  if(anchor)anchor.insertAdjacentHTML('afterend',markup);else block.insertAdjacentHTML('afterbegin',markup);
  $('imageGenerationEnabled').onchange=saveConversationSettingsV10;
}
const hydrateRightV10Base=hydrateRight;
hydrateRight=function(){
  hydrateRightV10Base();
  ensureImageGenerationSettingV10();
  if($('imageGenerationEnabled'))$('imageGenerationEnabled').checked=!!current?.imageGenerationEnabled;
};
async function saveConversationSettingsV10(){
  if(!current)return;
  const value=$('conversationModel').value,parts=value.split('::'),presetId=parts[0]||'',model=parts[1]||'';
  const appearance={avatarSize:+$('avatarSize').value,avatarRadius:+$('avatarRadius').value,bubbleWidth:+$('bubbleWidth').value,userBubble:$('userBubble').value,aiBubble:$('aiBubble').value,userBubbleText:$('userBubbleText')?.value||'',aiBubbleText:$('aiBubbleText')?.value||''};
  try{
    await updateConversation(current.id,{presetId,model,multiBubble:$('multiBubble').checked,appearance,imageRetention:$('imageRetention')?.value||'5-turns',autoTranslate:!!$('autoTranslate')?.checked,imageGenerationEnabled:!!$('imageGenerationEnabled')?.checked});
    applyAppearance();
    await reloadRoomMessagesV3();
  }catch(error){toast('保存设置失败：'+error.message,'error')}
}
saveConversationSettings=saveConversationSettingsV10;
function bindImageGenerationSettingV10(){
  ['conversationModel','multiBubble','avatarSize','avatarRadius','bubbleWidth','userBubble','aiBubble','userBubbleText','aiBubbleText','imageRetention','autoTranslate','imageGenerationEnabled'].forEach(id=>{const input=$(id);if(input)input.onchange=saveConversationSettingsV10});
}
function enhanceImageGenerationSettingV10(){ensureImageGenerationSettingV10();bindImageGenerationSettingV10()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceImageGenerationSettingV10);else enhanceImageGenerationSettingV10();

// Conversation tools V11: let each side choose a readable text colour for
// its own bubbles.  The controls are inserted beside the existing bubble
// background colours so older saved conversations remain compatible.
function ensureBubbleTextColourSettingsV11(){
  if($('userBubbleText'))return;
  const anchor=$('aiBubble')?.closest('label');
  if(!anchor)return;
  anchor.insertAdjacentHTML('afterend','<label class="setting-row"><span>我的文字</span><input id="userBubbleText" type="color"></label><label class="setting-row"><span>TA 的文字</span><input id="aiBubbleText" type="color"></label>');
  ['userBubbleText','aiBubbleText'].forEach(id=>$(id).onchange=saveConversationSettingsV10);
}
function setBubbleTextColoursV11(){
  const a=current?.appearance||{},fallback='#2b2522';
  if($('userBubbleText'))$('userBubbleText').value=a.userBubbleText||fallback;
  if($('aiBubbleText'))$('aiBubbleText').value=a.aiBubbleText||fallback;
}
function injectBubbleTextColourStylesV11(){
  if($('bubbleTextColourStylesV11'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="bubbleTextColourStylesV11">:root{--chat-user-bubble-text:var(--chat-text);--chat-ai-bubble-text:var(--chat-text)}.message-group.user .bubble,.user .bubble{color:var(--chat-user-bubble-text)}.message-group.assistant .bubble,.assistant .bubble{color:var(--chat-ai-bubble-text)}</style>');
}
const hydrateRightV11Base=hydrateRight;
hydrateRight=function(){
  hydrateRightV11Base();
  ensureBubbleTextColourSettingsV11();
  setBubbleTextColoursV11();
};
function enhanceBubbleTextColourSettingsV11(){
  injectBubbleTextColourStylesV11();
  ensureBubbleTextColourSettingsV11();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceBubbleTextColourSettingsV11);else enhanceBubbleTextColourSettingsV11();

// Right drawer V12: compact, menu-like settings.  Model selection deliberately
// starts with presets, so a large model list never becomes the first screen.
const rightMenuIconV12={
  model:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  beauty:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h2a7 7 0 0 0 0-10Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7.8" r="1"/></svg>',
  display:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/></svg>',
  translate:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h11M9.5 5c0 6-2.2 9.5-5.5 12M6 12c1.4 1.7 3.3 3.1 5.6 4"/><path d="m14 17 3-9 3 9m-5-3h4"/></svg>',
  image:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3.2 3.2 2.5-2.5L20 19"/></svg>',
  storage:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M5 7l1 13h12l1-13M9 11v5M15 11v5M8 7l1-3h6l1 3"/></svg>'
};
function rightAccordionV12(id,icon,label){return '<section class="right-menu-section" data-right-section="'+id+'"><button type="button" class="right-menu-summary" aria-expanded="false" data-right-toggle="'+id+'"><span class="right-menu-icon">'+icon+'</span><span>'+label+'</span><svg class="right-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button><div class="right-menu-panel" id="rightMenuPanel-'+id+'"></div></section>'}
function injectRightDrawerMenuStylesV12(){
  if($('rightDrawerMenuStylesV12'))return;
  const css=[
    '#rightDrawer .drawer-scroll{padding:8px 14px 20px}',
    '#rightSettingsMenuV12{display:grid;gap:2px}',
    '.right-menu-model{padding:8px 0 13px;margin-bottom:4px;border-bottom:1px solid var(--chat-border)}',
    '.right-menu-model-label{display:flex;align-items:center;gap:10px;margin:0 4px 8px;color:var(--chat-muted);font-size:12px}',
    '.right-menu-icon{display:grid;place-items:center;width:27px;height:27px;color:var(--chat-accent);flex:none}.right-menu-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    '.right-model-picker{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:43px;padding:10px 11px;border:1px solid var(--chat-border);border-radius:12px;background:var(--chat-bg);color:var(--chat-text);font:13px var(--font-b);text-align:left;cursor:pointer}.right-model-picker span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.right-model-picker svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.right-menu-section{border-bottom:1px solid var(--chat-border)}.right-menu-summary{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:7px 2px;border:0;background:transparent;color:var(--chat-text);font:400 15px var(--font-b);text-align:left;cursor:pointer}.right-menu-chevron{width:18px;height:18px;margin-left:auto;fill:none;stroke:var(--chat-muted);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s}.right-menu-summary[aria-expanded="true"] .right-menu-chevron{transform:rotate(180deg)}.right-menu-panel{display:none;padding:0 1px 12px}.right-menu-summary[aria-expanded="true"]+.right-menu-panel{display:block}',
    '.right-menu-panel .setting-block{padding:0;border:0}.right-menu-panel .setting-block h3{display:none}.right-menu-panel .setting-row{min-height:35px;margin:7px 0}.right-menu-panel .setting-row input[type=range]{max-width:168px}.right-menu-panel .room-storage-actions{margin-top:12px}.right-menu-panel .storage-note{margin-bottom:0}',
    '.right-menu-switches{padding:4px 0 7px;border-bottom:1px solid var(--chat-border)}.right-menu-switches .setting-row{min-height:46px;margin:0;padding:2px;color:var(--chat-text)}.right-menu-switches .setting-row>span{display:flex;align-items:center;gap:10px}.right-menu-switches small{display:block;margin-top:2px;color:var(--chat-muted);font-size:10px;line-height:1.35}.right-menu-inline-icon{display:grid;place-items:center;width:27px;height:27px;color:var(--chat-accent);flex:none}.right-menu-inline-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    '.right-model-sheet{position:fixed;inset:0;z-index:390;display:none;align-items:flex-end;background:rgba(25,22,20,.34)}.right-model-sheet.open{display:flex}.right-model-sheet-card{width:100%;max-height:min(72vh,620px);overflow:auto;padding:14px 14px calc(18px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0;background:var(--chat-surface);box-shadow:0 -12px 32px rgba(33,25,21,.17)}.right-model-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 3px 10px}.right-model-sheet-head strong{font:400 21px var(--font-d);color:var(--chat-text)}.right-model-sheet-close{width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:var(--chat-muted);font-size:27px;line-height:1;cursor:pointer}.right-model-sheet-list{display:grid;gap:8px}.right-model-preset,.right-model-choice,.right-model-follow{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:13px;border:1px solid var(--chat-border);border-radius:13px;background:var(--chat-bg);color:var(--chat-text);font-family:var(--font-b);text-align:left;cursor:pointer}.right-model-preset strong,.right-model-choice strong{display:block;font-size:14px}.right-model-preset small,.right-model-choice small{display:block;margin-top:3px;color:var(--chat-muted);font-size:11px}.right-model-preset svg,.right-model-choice svg{width:18px;height:18px;flex:none;fill:none;stroke:var(--chat-muted);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.right-model-follow{color:var(--chat-muted);font-size:12px}.right-model-empty{padding:20px 8px;color:var(--chat-muted);font-size:13px;text-align:center}',
    '@media(min-width:700px){.right-model-sheet{align-items:center;justify-content:center}.right-model-sheet-card{width:min(420px,92vw);max-height:70vh;border-radius:20px;padding-bottom:18px}}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="rightDrawerMenuStylesV12">'+css+'</style>');
}
function ensureModelSheetV12(){
  if($('rightModelSheetV12'))return;
  document.body.insertAdjacentHTML('beforeend','<div class="right-model-sheet" id="rightModelSheetV12" aria-hidden="true"><div class="right-model-sheet-card" role="dialog" aria-modal="true" aria-labelledby="rightModelSheetTitle"><div class="right-model-sheet-head"><strong id="rightModelSheetTitle">选择预设</strong><button type="button" class="right-model-sheet-close" aria-label="关闭">×</button></div><div class="right-model-sheet-list" id="rightModelSheetListV12"></div></div></div>');
  const sheet=$('rightModelSheetV12');
  sheet.querySelector('.right-model-sheet-close').onclick=()=>closeModelSheetV12();
  sheet.onclick=event=>{if(event.target===sheet)closeModelSheetV12()};
}
function closeModelSheetV12(){const sheet=$('rightModelSheetV12');if(sheet){sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true')}}
function setModelPickerLabelV12(){
  const label=$('rightModelPickerLabelV12');
  if(!label)return;
  const preset=(settings.presets||[]).find(item=>item.id===current?.presetId);
  label.textContent=preset?(preset.name||'未命名预设')+' · '+(current?.model||'选择模型'):'跟随主模型';
}
function chooseConversationModelV12(presetId='',model=''){
  const select=$('conversationModel');
  if(!select)return;
  select.value=presetId&&model?presetId+'::'+model:'';
  select.dispatchEvent(new Event('change',{bubbles:true}));
  setModelPickerLabelV12();
  closeModelSheetV12();
}
function openModelSheetV12(presetId=''){
  ensureModelSheetV12();
  const presets=settings.presets||[],sheet=$('rightModelSheetV12'),title=$('rightModelSheetTitle'),list=$('rightModelSheetListV12');
  sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');
  if(!presetId){
    title.textContent='选择模型预设';
    const follow='<button type="button" class="right-model-follow" data-model-follow>跟随主模型 <span>›</span></button>';
    list.innerHTML=follow+(presets.length?presets.map(p=>'<button type="button" class="right-model-preset" data-model-preset="'+esc(p.id)+'"><span><strong>'+esc(p.name||'未命名预设')+'</strong><small>'+(p.models||[p.model].filter(Boolean)).length+' 个已保存模型</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>').join(''):'<p class="right-model-empty">还没有保存模型预设。请到左侧“模型设置”创建。</p>');
    list.querySelector('[data-model-follow]')?.addEventListener('click',()=>chooseConversationModelV12());
    list.querySelectorAll('[data-model-preset]').forEach(button=>button.onclick=()=>openModelSheetV12(button.dataset.modelPreset));
    return;
  }
  const preset=presets.find(item=>item.id===presetId);
  if(!preset){openModelSheetV12();return}
  const models=(preset.models||[preset.model].filter(Boolean));
  title.textContent=preset.name||'未命名预设';
  list.innerHTML='<button type="button" class="right-model-follow" data-model-back>‹ 返回预设列表</button>'+(models.length?models.map(model=>'<button type="button" class="right-model-choice" data-model-value="'+esc(model)+'"><span><strong>'+esc(model)+'</strong><small>'+esc(preset.name||'当前预设')+'</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>').join(''):'<p class="right-model-empty">这个预设还没有保存模型。</p>');
  list.querySelector('[data-model-back]')?.addEventListener('click',()=>openModelSheetV12());
  list.querySelectorAll('[data-model-value]').forEach(button=>button.onclick=()=>chooseConversationModelV12(preset.id,button.dataset.modelValue));
}
function moveRightMenuRowV12(id,target){const row=$(id)?.closest('.setting-row');if(row&&target)target.append(row)}
function ensureRightDrawerMenuV12(){
  const scroll=$('rightDrawer')?.querySelector('.drawer-scroll');
  if(!scroll)return;
  ensureBubbleTextColourSettingsV11();
  ensureLanguageSettingsV4();
  ensureImageGenerationSettingV10();
  if($('rightSettingsMenuV12'))return;
  const modelBlock=$('conversationModel')?.closest('.setting-block');
  const displayBlock=$('multiBubble')?.closest('.setting-block');
  const beautyBlock=$('userBubble')?.closest('.setting-block');
  const storageBlock=$('roomStorageSettings');
  const note=scroll.querySelector('.empty-note');
  const root=document.createElement('div');root.id='rightSettingsMenuV12';
  root.innerHTML='<section class="right-menu-model"><div class="right-menu-model-label"><span class="right-menu-icon">'+rightMenuIconV12.model+'</span><span>当前模型</span></div><button type="button" class="right-model-picker" id="rightModelPickerV12"><span id="rightModelPickerLabelV12">跟随主模型</span><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button><div hidden id="rightModelNativeV12"></div></section>'+rightAccordionV12('beauty',rightMenuIconV12.beauty,'美化')+rightAccordionV12('display',rightMenuIconV12.display,'显示')+'<section class="right-menu-switches" id="rightMenuSwitchesV12"></section>'+rightAccordionV12('storage',rightMenuIconV12.storage,'存储管理');
  scroll.append(root);
  if(modelBlock){const select=$('conversationModel');if(select)$('rightModelNativeV12').append(select);modelBlock.remove()}
  if(displayBlock){displayBlock.querySelector('h3')?.remove();$('rightMenuPanel-display').append(displayBlock)}
  if(beautyBlock){beautyBlock.querySelector('h3')?.remove();$('rightMenuPanel-beauty').append(beautyBlock)}
  const switches=$('rightMenuSwitchesV12');
  moveRightMenuRowV12('autoTranslate',switches);moveRightMenuRowV12('imageGenerationEnabled',switches);
  const labelIcon={autoTranslate:rightMenuIconV12.translate,imageGenerationEnabled:rightMenuIconV12.image};
  ['autoTranslate','imageGenerationEnabled'].forEach(id=>{const row=$(id)?.closest('.setting-row'),span=row?.querySelector('span');if(row&&span&&!span.querySelector('.right-menu-inline-icon'))span.insertAdjacentHTML('afterbegin','<i class="right-menu-inline-icon">'+labelIcon[id]+'</i>')});
  if(storageBlock){storageBlock.querySelector('h3')?.remove();$('rightMenuPanel-storage').append(storageBlock)}
  note?.remove();
  root.querySelectorAll('[data-right-toggle]').forEach(button=>button.onclick=()=>{const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open))});
  $('rightModelPickerV12').onclick=()=>openModelSheetV12();
  ensureModelSheetV12();
}
const hydrateRightV12Base=hydrateRight;
hydrateRight=function(){
  hydrateRightV12Base();
  ensureRightDrawerMenuV12();
  setBubbleTextColoursV11();
  setModelPickerLabelV12();
};
function enhanceRightDrawerMenuV12(){injectRightDrawerMenuStylesV12();ensureRightDrawerMenuV12()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceRightDrawerMenuV12);else enhanceRightDrawerMenuV12();

// Right drawer V13: wording/icon polish and hexadecimal fields beside every
// colour swatch.  The text inputs accept both C27B7B and #C27B7B.
const rightMenuIconV13={
  robot:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a1 1 0 0 1 1 1v2h-2V3a1 1 0 0 1 1-1Z"/><rect x="4" y="6" width="16" height="12" rx="3" ry="3"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><path d="M9.5 16a2.5 2.5 0 0 0 5 0"/><path d="M2 10v4"/><path d="M22 10v4"/></svg>',
  brush:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 4.5 5 5M13 6l5 5-7.6 7.6c-1.1 1.1-2.7 1.6-4.2 1.2l-1.2-.3.3-1.2c.4-1.5 1-3 2.1-4.1L13 6Z"/><path d="M4 20c1.6.5 3.1.3 4.4-.7"/></svg>'
};
function normaliseHexV13(value){
  const hex=String(value||'').trim().replace(/^#/,'');
  return /^[0-9a-fA-F]{6}$/.test(hex)?'#'+hex.toUpperCase():'';
}
function updateColourCodeV13(colourId){
  const colour=$(colourId),code=$(colourId+'Code');
  if(colour&&code)code.value=(colour.value||'').replace('#','').toUpperCase();
}
function ensureColourCodeFieldsV13(){
  ['userBubble','aiBubble','userBubbleText','aiBubbleText'].forEach(colourId=>{
    const colour=$(colourId),row=colour?.closest('.setting-row');
    if(!colour||!row)return;
    if(!$(colourId+'Code'))row.insertAdjacentHTML('beforeend','<input class="colour-code-input" id="'+colourId+'Code" type="text" inputmode="text" maxlength="7" autocomplete="off" spellcheck="false" aria-label="'+colourId+' 颜色代码" placeholder="C27B7B">');
    const code=$(colourId+'Code');
    if(!code.dataset.colourCodeReady){
      code.dataset.colourCodeReady='true';
      code.addEventListener('change',()=>{
        const normalised=normaliseHexV13(code.value);
        if(!normalised){code.value=(colour.value||'').replace('#','').toUpperCase();return}
        colour.value=normalised;
        code.value=normalised.slice(1);
        colour.dispatchEvent(new Event('change',{bubbles:true}));
      });
      colour.addEventListener('change',()=>updateColourCodeV13(colourId));
    }
    updateColourCodeV13(colourId);
  });
}
function findMenuTextV13(selector){return document.querySelector(selector)}
function polishRightDrawerV13(){
  const drawer=$('rightDrawer');
  if(!drawer)return;
  const heading=drawer.querySelector('.drawer-head h2');
  if(heading)heading.textContent='Chat Settings';
  const modelIcon=drawer.querySelector('.right-menu-model-label .right-menu-icon');
  if(modelIcon)modelIcon.innerHTML=rightMenuIconV13.robot;
  const beautyIcon=drawer.querySelector('[data-right-section="beauty"] .right-menu-icon');
  if(beautyIcon)beautyIcon.innerHTML=rightMenuIconV13.brush;
  const translateRow=$('autoTranslateRow'),imageRow=$('imageGenerationRow');
  const translateText=translateRow?.children?.[0];
  if(translateText){
    const icon=translateText.querySelector('.right-menu-inline-icon');
    translateText.innerHTML=(icon?icon.outerHTML:'<i class="right-menu-inline-icon"></i>')+'<span class="right-menu-label-text">翻译</span>';
    const translateIcon=translateText.querySelector('.right-menu-inline-icon');
    if(translateIcon){translateIcon.classList.add('right-translate-icon-v13');translateIcon.innerHTML='<b>A<i>a</i></b>'}
  }
  const imageText=imageRow?.children?.[0];
  if(imageText){
    const icon=imageText.querySelector('.right-menu-inline-icon');
    imageText.innerHTML=(icon?icon.outerHTML:'<i class="right-menu-inline-icon">'+rightMenuIconV12.image+'</i>')+'<span class="right-menu-label-text">本房间生图</span>';
  }
  const storageLabel=findMenuTextV13('[data-right-section="storage"] .right-menu-summary > span:not(.right-menu-icon)');
  if(storageLabel)storageLabel.textContent='存储';
  ensureColourCodeFieldsV13();
}
function injectRightDrawerPolishStylesV13(){
  if($('rightDrawerPolishStylesV13'))return;
  const css=[
    '.right-menu-switches .setting-row+.setting-row{border-top:1px solid var(--chat-border)}.right-menu-switches .right-menu-label-text{font:400 15px var(--font-b);color:var(--chat-text)}',
    '.right-translate-icon-v13 b{display:flex;align-items:baseline;line-height:1;font-family:Georgia,serif;font-size:19px;font-weight:500}.right-translate-icon-v13 b i{margin-left:1px;font-size:12px;font-style:normal}',
    '.right-menu-panel .setting-row:has(input[type=color]){gap:8px}.colour-code-input{width:78px!important;max-width:78px!important;box-sizing:border-box;padding:7px 6px!important;border:1px solid var(--chat-border)!important;border-radius:8px!important;background:var(--chat-bg)!important;color:var(--chat-text)!important;font:11px ui-monospace,SFMono-Regular,Consolas,monospace!important;letter-spacing:.02em;text-transform:uppercase}.colour-code-input::placeholder{color:var(--chat-muted);opacity:.65;text-transform:none}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="rightDrawerPolishStylesV13">'+css+'</style>');
}
const hydrateRightV13Base=hydrateRight;
hydrateRight=function(){hydrateRightV13Base();polishRightDrawerV13()};
function enhanceRightDrawerV13(){injectRightDrawerPolishStylesV13();polishRightDrawerV13()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceRightDrawerV13);else enhanceRightDrawerV13();

// Room appearance V14: compact left navigation plus room-only background and
// bubble font choices.  Font data stays on the conversation, not in the global
// theme, so each chat can keep its own visual identity.
const chatBubbleIconV14='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/></svg>';
function conversationRowV14(c){return '<div class="conversation '+(current?.id===c.id?'active':'')+'" data-id="'+c.id+'"><span class="conversation-title"><i class="conversation-icon-v14">'+chatBubbleIconV14+'</i><span>'+esc(c.title)+'</span></span><button class="more-btn" aria-label="对话菜单">'+ICON.more+'</button></div>'}
conversationRow=conversationRowV14;
function leftAccordionV14(){return '<section class="left-menu-section-v14 left-tool-shelf-v14"><button type="button" class="left-menu-action-v14" data-left-panel="models"><span class="left-menu-icon-v14">'+GEAR+'</span>模型设置</button><button type="button" class="left-menu-action-v14" data-left-panel="roles"><span class="left-menu-icon-v14">'+ICON.role+'</span>角色卡</button><button type="button" class="left-menu-action-v14" data-left-panel="archive"><span class="left-menu-icon-v14">'+ICON.archive+'</span>归档</button><button type="button" class="left-menu-action-v14" data-left-panel="notifications"><span class="left-menu-icon-v14">'+NOTIFICATION_BELL_V82+'</span>通知</button></section>'}
function ensureLeftDrawerV14(){
  const drawer=$('leftDrawer'),nav=drawer?.querySelector('.nav-grid');if(!drawer)return;
  const newChat=$('newChatBtn');if(newChat)newChat.innerHTML='<span class="new-chat-plus-v14">'+ICON.plus+'</span><span>New chat</span>';
  if(!$('leftSettingsMenuV14')&&nav){
    const root=document.createElement('div');root.id='leftSettingsMenuV14';root.innerHTML=leftAccordionV14();nav.replaceWith(root);
    root.querySelectorAll('[data-left-panel]').forEach(button=>button.onclick=()=>button.dataset.leftPanel==='notifications'?openNotificationPanelV82():openPanel(button.dataset.leftPanel));
  }
}
function compactMenuPositionV14(menu,button,actions){
  const rect=button.getBoundingClientRect(),width=148,height=actions*39+12;
  menu.style.left=Math.max(10,Math.min(rect.right-width,innerWidth-width-10))+'px';
  menu.style.top=Math.max(10,Math.min(rect.bottom+5,innerHeight-height-10))+'px';
}
function openConversationMenuV14(id,btn){
  const c=conversations.find(x=>x.id===id),menu=$('conversationMenu');if(!c||!menu)return;
  menu.dataset.id=id;menu.className='menu-pop compact-context-menu-v14';
  menu.innerHTML='<button data-act="rename">'+ICON.edit+'<span>重命名</span></button><button data-act="pin">'+ICON.pin+'<span>'+(c.pinned?'取消置顶':'置顶')+'</span></button><button data-act="archive">'+ICON.archive+'<span>归档</span></button><button class="danger" data-act="delete">'+ICON.trash+'<span>删除</span></button>';
  compactMenuPositionV14(menu,btn,4);menu.classList.add('open');
}
function openRoleMenuV14(id,btn){
  const menu=$('roleMenu');if(!menu)return;
  menu.dataset.id=id;menu.className='menu-pop role-menu compact-context-menu-v14';
  menu.innerHTML='<button data-act="edit">'+ICON.edit+'<span>编辑</span></button><button class="danger" data-act="delete">'+ICON.trash+'<span>删除</span></button>';
  compactMenuPositionV14(menu,btn,2);menu.classList.add('open');
}
openConversationMenu=openConversationMenuV14;openRoleMenu=openRoleMenuV14;
function roomAppearanceV14(){return current?.appearance||{}}
function roomHexV14(value,fallback){return normaliseHexV13(value)||fallback}
async function uploadRoomFontV14(file){
  const name=Date.now()+'-'+String(file.name||'bubble-font').replace(/[^a-zA-Z0-9._-]/g,'_');
  const response=await fetch(BASE+'/api/upload-font?name='+encodeURIComponent(name),{method:'POST',headers:{'x-api-key':KEY,'Content-Type':file.type||'application/octet-stream'},body:file});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'字体上传失败');return data.url||'';
}
function ensureRoomAppearanceSettingsV14(){
  const panel=$('rightMenuPanel-beauty');if(!panel||$('chatBackgroundV14'))return;
  panel.insertAdjacentHTML('beforeend','<div class="room-appearance-v14" id="roomAppearanceV14"><p class="room-appearance-heading-v14">聊天背景</p><label class="setting-row" id="chatBackgroundV14"><span>背景颜色</span><input id="chatBackground" type="color"><input class="colour-code-input" id="chatBackgroundCode" type="text" inputmode="text" maxlength="7" autocomplete="off" spellcheck="false" placeholder="C27B7B"></label><div class="bubble-font-settings-v14"><p class="room-appearance-heading-v14">气泡字体</p><label class="bubble-font-row-v14"><span>我的字体链接</span><input id="userBubbleFontUrl" type="url" inputmode="url" placeholder="https://…/font.woff2"></label><label class="bubble-font-row-v14"><span>上传我的字体</span><input id="userBubbleFontFile" type="file" accept=".woff,.woff2,.ttf,.otf,font/*"></label><label class="bubble-font-row-v14"><span>TA 的字体链接</span><input id="aiBubbleFontUrl" type="url" inputmode="url" placeholder="https://…/font.woff2"></label><label class="bubble-font-row-v14"><span>上传 TA 的字体</span><input id="aiBubbleFontFile" type="file" accept=".woff,.woff2,.ttf,.otf,font/*"></label><div class="bubble-font-actions-v14"><button type="button" id="clearUserBubbleFont">我的：使用全局字体</button><button type="button" id="clearAiBubbleFont">TA：使用全局字体</button></div><small>可填字体文件链接，或上传 woff / woff2 / ttf / otf 文件。字体仅用于当前聊天。</small></div></div>');
  const colour=$('chatBackground'),code=$('chatBackgroundCode');
  colour.onchange=()=>{colour.dataset.touched='true';code.value=colour.value.slice(1).toUpperCase();saveConversationSettingsV14()};
  code.onchange=()=>{const value=normaliseHexV13(code.value);if(!value){code.value=colour.value.slice(1).toUpperCase();return}colour.value=value;colour.dataset.touched='true';code.value=value.slice(1);saveConversationSettingsV14()};
  [['userBubbleFont','userBubbleFontUrl','userBubbleFontFile'],['aiBubbleFont','aiBubbleFontUrl','aiBubbleFontFile']].forEach(([key,urlId,fileId])=>{
    const url=$(urlId),file=$(fileId);
    url.onchange=()=>{url.dataset.source=url.value.trim();saveConversationSettingsV14()};
    file.onchange=async()=>{const selected=file.files?.[0];if(!selected)return;if(selected.size>2*1024*1024){file.value='';toast('字体文件请控制在 2MB 以内','error');return}try{url.dataset.source=await uploadRoomFontV14(selected);url.value='';file.dataset.filename=selected.name;toast('字体已上传，保存后生效','success');await saveConversationSettingsV14()}catch(error){toast(error.message||'字体上传失败','error')}};
    $('clear'+(key==='userBubbleFont'?'User':'Ai')+'BubbleFont').onclick=()=>{url.value='';url.dataset.source='';file.value='';delete file.dataset.filename;saveConversationSettingsV14()};
  });
}
function hydrateRoomAppearanceSettingsV14(){
  ensureRoomAppearanceSettingsV14();
  const appearance=roomAppearanceV14(),background=$('chatBackground'),code=$('chatBackgroundCode');
  if(background){background.value=roomHexV14(appearance.chatBackground,'#F7F5F3');background.dataset.touched=appearance.chatBackground?'true':'';code.value=background.value.slice(1).toUpperCase()}
  [['userBubbleFont','userBubbleFontUrl','userBubbleFontFile'],['aiBubbleFont','aiBubbleFontUrl','aiBubbleFontFile']].forEach(([key,urlId,fileId])=>{const source=appearance[key]||'',url=$(urlId),file=$(fileId);if(!url)return;url.dataset.source=source;url.value=source&&!source.startsWith('data:')?source:'';if(source.startsWith('data:'))file.dataset.filename='已上传字体';else delete file.dataset.filename});
}
function fontFaceCssV14(family,source){if(!source)return '';return '@font-face{font-family:"'+family+'";src:url("'+String(source).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'");font-display:swap;}'}
function applyRoomAppearanceV14(){
  const appearance=roomAppearanceV14(),root=document.documentElement;
  if(appearance.chatBackground)root.style.setProperty('--chat-room-bg',appearance.chatBackground);else root.style.removeProperty('--chat-room-bg');
  root.style.setProperty('--chat-user-bubble-font',appearance.userBubbleFont?'ChatUserBubbleV14, var(--font-b)':'var(--font-b)');
  root.style.setProperty('--chat-ai-bubble-font',appearance.aiBubbleFont?'ChatAiBubbleV14, var(--font-b)':'var(--font-b)');
  let style=$('bubbleFontsV14');if(!style){style=document.createElement('style');style.id='bubbleFontsV14';document.head.append(style)}style.textContent=fontFaceCssV14('ChatUserBubbleV14',appearance.userBubbleFont)+fontFaceCssV14('ChatAiBubbleV14',appearance.aiBubbleFont);
}
const applyAppearanceV14Base=applyAppearance;
applyAppearance=function(){applyAppearanceV14Base();applyRoomAppearanceV14()};
async function saveConversationSettingsV14(){
  if(!current)return;
  const value=$('conversationModel')?.value||'',parts=value.split('::'),presetId=parts[0]||'',model=parts[1]||'',old=roomAppearanceV14(),background=$('chatBackground');
  const source=id=>$(id)?.dataset.source??$(id)?.value.trim()??'';
  const appearance={...old,avatarSize:+$('avatarSize').value,avatarRadius:+$('avatarRadius').value,bubbleWidth:+$('bubbleWidth').value,userBubble:$('userBubble').value,aiBubble:$('aiBubble').value,userBubbleText:$('userBubbleText')?.value||'',aiBubbleText:$('aiBubbleText')?.value||'',chatBackground:(background?.dataset.touched||old.chatBackground)?(background?.value||''):'',userBubbleFont:source('userBubbleFontUrl'),aiBubbleFont:source('aiBubbleFontUrl')};
  try{await updateConversation(current.id,{presetId,model,multiBubble:$('multiBubble').checked,appearance,imageRetention:$('imageRetention')?.value||'5-turns',autoTranslate:!!$('autoTranslate')?.checked,imageGenerationEnabled:!!$('imageGenerationEnabled')?.checked});applyAppearance();await reloadRoomMessagesV3()}catch(error){toast('保存设置失败：'+error.message,'error')}
}
function bindRoomAppearanceSettingsV14(){['conversationModel','multiBubble','avatarSize','avatarRadius','bubbleWidth','userBubble','aiBubble','userBubbleText','aiBubbleText','imageRetention','autoTranslate','imageGenerationEnabled'].forEach(id=>{const input=$(id);if(input)input.onchange=saveConversationSettingsV14})}
function setupRolePickerDismissV14(){
  const picker=$('rolePicker'),close=$('closeRolePicker');if(!picker)return;
  if(close){close.setAttribute('aria-label','取消选择');close.onclick=()=>picker.classList.remove('open')}
  picker.onclick=event=>{if(event.target===picker)picker.classList.remove('open')};
  document.addEventListener('keydown',event=>{if(event.key==='Escape')picker.classList.remove('open')});
}
function injectRoomAppearanceStylesV14(){
  if($('roomAppearanceStylesV14'))return;
  const css=[
    '#leftDrawer .drawer-scroll{padding:8px 14px 20px}#leftDrawer .new-chat{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;min-height:45px!important;margin:1px 0 5px!important;padding:10px 13px!important;border:1px solid var(--chat-border)!important;border-radius:12px!important;background:var(--chat-bg)!important;color:var(--chat-text)!important;font:400 15px var(--font-b)!important;text-align:left!important}.new-chat-plus-v14{display:grid;place-items:center;width:21px;height:21px;color:var(--chat-accent)}.new-chat-plus-v14 svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.left-menu-section-v14{margin:2px 0 7px;border-bottom:1px solid var(--chat-border)}.left-menu-summary-v14{display:flex;align-items:center;gap:10px;width:100%;min-height:50px;padding:7px 2px;border:0;background:transparent;color:var(--chat-text);font:400 15px var(--font-b);text-align:left;cursor:pointer}.left-menu-summary-v14>svg{width:18px;height:18px;margin-left:auto;fill:none;stroke:var(--chat-muted);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s}.left-menu-summary-v14[aria-expanded="true"]>svg{transform:rotate(180deg)}.left-menu-icon-v14{display:grid;place-items:center;width:27px;height:27px;color:var(--chat-accent);flex:none}.left-menu-icon-v14 svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.left-menu-panel-v14{display:none;padding:0 1px 9px}.left-menu-summary-v14[aria-expanded="true"]+.left-menu-panel-v14{display:grid;gap:2px}.left-menu-action-v14{display:flex;align-items:center;gap:9px;min-height:40px;padding:7px 5px;border:0;border-radius:10px;background:transparent;color:var(--chat-text);font:14px var(--font-b);text-align:left;cursor:pointer}.left-menu-action-v14:active,.left-menu-action-v14:hover{background:var(--accent-pale)}.conversation-title{display:flex!important;align-items:center;gap:8px;min-width:0}.conversation-title>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.conversation-icon-v14{display:grid;place-items:center;width:18px;height:18px;color:var(--chat-muted);flex:none}.conversation-icon-v14 svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    '.left-tool-shelf-v14{display:grid;gap:2px;padding:3px 1px 9px}.left-tool-shelf-v14 .left-menu-action-v14{min-height:46px;padding:7px 5px;font-size:15px}.compact-context-menu-v14{box-sizing:border-box;width:148px!important;min-width:148px!important;max-width:calc(100vw - 20px)!important;padding:5px!important;border:1px solid var(--chat-border)!important;border-radius:13px!important;background:var(--chat-surface)!important;box-shadow:var(--shadow-md)!important;z-index:900!important}.compact-context-menu-v14 button{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;min-height:34px!important;padding:7px 8px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:var(--chat-text)!important;font:13px var(--font-b)!important;text-align:left!important;line-height:1.2!important}.compact-context-menu-v14 button svg{width:16px!important;height:16px!important;flex:none!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important}.compact-context-menu-v14 button.danger{color:#b14f4f!important}.compact-context-menu-v14 button:active,.compact-context-menu-v14 button:hover{background:var(--accent-pale)!important}',
    '.room-appearance-v14{margin-top:12px;padding-top:10px;border-top:1px solid var(--chat-border)}.room-appearance-heading-v14{margin:0 0 5px;color:var(--chat-text);font:500 13px var(--font-b)}.bubble-font-settings-v14{margin-top:12px}.bubble-font-row-v14{display:grid;grid-template-columns:minmax(82px,.8fr) minmax(0,1.2fr);align-items:center;gap:8px;min-height:36px;margin:6px 0;color:var(--chat-muted);font:12px var(--font-b)}.bubble-font-row-v14 input[type=url]{min-width:0;width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid var(--chat-border);border-radius:8px;background:var(--chat-bg);color:var(--chat-text);font:11px var(--font-b)}.bubble-font-row-v14 input[type=file]{width:100%;min-width:0;color:var(--chat-muted);font:10px var(--font-b)}.bubble-font-actions-v14{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.bubble-font-actions-v14 button{min-height:32px;padding:6px;border:1px solid var(--chat-border);border-radius:8px;background:var(--chat-bg);color:var(--chat-muted);font:10px var(--font-b);cursor:pointer}.bubble-font-settings-v14 small{display:block;margin-top:8px;color:var(--chat-muted);font-size:10px;line-height:1.45}.chat-room #chatMain{background:var(--chat-room-bg,var(--chat-bg))}.chat-room .composer{background:linear-gradient(to bottom,transparent 0,var(--chat-room-bg,var(--chat-bg)) 26%)}.message-group.user .bubble{font-family:var(--chat-user-bubble-font,var(--font-b))}.message-group.assistant .bubble{font-family:var(--chat-ai-bubble-font,var(--font-b))}.modal-overlay .modal-close{display:grid!important;place-items:center!important;width:34px!important;height:34px!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;color:var(--chat-muted)!important;font-size:22px!important;cursor:pointer!important}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="roomAppearanceStylesV14">'+css+'</style>');
}
const hydrateRightV14Base=hydrateRight;
hydrateRight=function(){hydrateRightV14Base();ensureRoomAppearanceSettingsV14();hydrateRoomAppearanceSettingsV14();bindRoomAppearanceSettingsV14();applyRoomAppearanceV14()};
function enhanceRoomAppearanceV14(){injectRoomAppearanceStylesV14();ensureLeftDrawerV14();ensureRoomAppearanceSettingsV14();bindRoomAppearanceSettingsV14();setupRolePickerDismissV14();applyRoomAppearanceV14();renderConversations()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceRoomAppearanceV14);else enhanceRoomAppearanceV14();

/* V15: make the welcome role picker dismissible and group the beauty colours. */
function ensureRolePickerCloseV15(){
  const picker=$('rolePicker'),modal=picker?.querySelector('.modal');if(!picker||!modal)return;
  let close=$('rolePickerCloseV15');
  if(!close){
    modal.insertAdjacentHTML('beforeend','<button type="button" class="role-picker-close-v15" id="rolePickerCloseV15" aria-label="关闭选择窗口">'+ICON.close+'</button>');
    close=$('rolePickerCloseV15');
  }
  close.onclick=()=>picker.classList.remove('open');
  picker.onclick=event=>{if(event.target===picker)picker.classList.remove('open')};
}
function ensureBeautyColourGroupsV15(){
  const panel=$('rightMenuPanel-beauty'),userBubble=$('userBubble'),userText=$('userBubbleText');if(!panel||!userBubble||!userText)return;
  if(!$('bubbleColourHeadingV15'))userBubble.closest('.setting-row')?.insertAdjacentHTML('beforebegin','<p class="room-appearance-heading-v14 colour-group-heading-v15" id="bubbleColourHeadingV15">气泡颜色</p>');
  if(!$('textColourHeadingV15'))userText.closest('.setting-row')?.insertAdjacentHTML('beforebegin','<p class="room-appearance-heading-v14 colour-group-heading-v15" id="textColourHeadingV15">字体颜色</p>');
}
function injectRoomAppearanceStylesV15(){
  if($('roomAppearanceStylesV15'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="roomAppearanceStylesV15">#rolePicker .modal{position:relative!important}#rolePicker .modal-header .modal-close{display:none!important}.role-picker-close-v15{position:absolute!important;top:12px!important;right:12px!important;z-index:6!important;display:grid!important;place-items:center!important;width:38px!important;height:38px!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;color:var(--chat-muted)!important;cursor:pointer!important}.role-picker-close-v15:hover,.role-picker-close-v15:active{background:var(--accent-pale)!important}.role-picker-close-v15 svg{width:22px!important;height:22px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important}.colour-group-heading-v15{margin-top:13px!important;margin-bottom:6px!important}.colour-group-heading-v15:first-child{margin-top:2px!important}</style>');
}
const hydrateRightV15Base=hydrateRight;
hydrateRight=function(){hydrateRightV15Base();ensureBeautyColourGroupsV15();ensureRolePickerCloseV15()};
function enhanceRoomAppearanceV15(){injectRoomAppearanceStylesV15();ensureRolePickerCloseV15();ensureBeautyColourGroupsV15()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceRoomAppearanceV15);else enhanceRoomAppearanceV15();

/* V16: keep the settings drawer compact and make bubble size controls effective. */
function injectRoomAppearanceStylesV16(){
  if($('roomAppearanceStylesV16'))return;
  document.head.insertAdjacentHTML('beforeend',`<style id="roomAppearanceStylesV16">
    .right-menu-model,.right-model-picker{min-width:0;max-width:100%;box-sizing:border-box}
    .right-model-picker{display:flex!important;align-items:center;gap:8px;overflow:hidden;width:100%}
    #rightModelPickerLabelV12{display:block;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .right-model-picker>svg{flex:0 0 auto}
    .message-group{min-width:0;width:100%;box-sizing:border-box}
    .message-group .bubble-stack{width:fit-content;min-width:0;max-width:min(var(--chat-bubble-max-width,75%),calc(100% - var(--chat-avatar-size,34px) - var(--chat-avatar-size,34px) - var(--message-avatar-gap,8px) - var(--message-avatar-gap,8px)))!important}
    .message-group .message-bubble-row,.message-group .bubble{max-width:100%;min-width:0}
    .message-group .bubble{font-size:var(--chat-bubble-font-size,16px)!important}
    #bubbleWidthValueV16,#bubbleFontSizeValueV16{margin-left:5px;color:var(--chat-muted);font-size:11px;font-weight:400;white-space:nowrap}
  </style>`)
}
function roomNumberV16(value,min,max,fallback){
  const number=Number(value);
  return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback
}
function ensureBubbleDisplayControlsV16(){
  const width=$('bubbleWidth');
  if(!width)return;
  width.min='45';width.max='100';width.step='1';
  const widthRow=width.closest('.setting-row');
  const widthLabel=widthRow?.querySelector('span');
  if(widthLabel&&!$('bubbleWidthValueV16'))widthLabel.insertAdjacentHTML('beforeend','<small id="bubbleWidthValueV16"></small>');
  if(widthRow&&!$('bubbleFontSize'))widthRow.insertAdjacentHTML('afterend','<label class="setting-row setting-row-bubble-font-size-v16" id="bubbleFontSizeRowV16"><span>气泡字体大小<small id="bubbleFontSizeValueV16"></small></span><input id="bubbleFontSize" type="range" min="12" max="24" step="1" value="16"></label>');
}
function syncBubbleControlsV16(){
  const width=$('bubbleWidth'),fontSize=$('bubbleFontSize');
  if(width&&$('bubbleWidthValueV16'))$('bubbleWidthValueV16').textContent=`${width.value}%`;
  if(fontSize&&$('bubbleFontSizeValueV16'))$('bubbleFontSizeValueV16').textContent=`${fontSize.value}px`;
}
function hydrateBubbleControlsV16(){
  ensureBubbleDisplayControlsV16();
  const appearance=roomAppearanceV14(),width=$('bubbleWidth'),fontSize=$('bubbleFontSize');
  if(width)width.value=String(roomNumberV16(appearance.bubbleWidth,45,100,75));
  if(fontSize)fontSize.value=String(roomNumberV16(appearance.bubbleFontSize,12,24,16));
  syncBubbleControlsV16()
}
function applyBubblePreviewV16(){
  const width=$('bubbleWidth'),fontSize=$('bubbleFontSize');
  if(width)document.documentElement.style.setProperty('--chat-bubble-max-width',`${roomNumberV16(width.value,45,100,75)}%`);
  if(fontSize)document.documentElement.style.setProperty('--chat-bubble-font-size',`${roomNumberV16(fontSize.value,12,24,16)}px`);
  syncBubbleControlsV16()
}
async function saveConversationSettingsV16(){
  if(!current)return;
  const value=$('conversationModel')?.value||'',parts=value.split('::'),presetId=parts[0]||'',model=parts[1]||'',old=roomAppearanceV14(),background=$('chatBackground');
  const source=id=>{const input=$(id);return input?(input.dataset.source??input.value.trim()):''};
  const appearance={
    ...old,
    avatarSize:+$('avatarSize').value,
    avatarRadius:+$('avatarRadius').value,
    bubbleWidth:roomNumberV16($('bubbleWidth')?.value,45,100,75),
    bubbleFontSize:roomNumberV16($('bubbleFontSize')?.value,12,24,16),
    userBubble:$('userBubble').value,
    aiBubble:$('aiBubble').value,
    userBubbleText:$('userBubbleText')?.value||'',
    aiBubbleText:$('aiBubbleText')?.value||'',
    chatBackground:(background?.dataset.touched||old.chatBackground)?(background?.value||''):'',
    userBubbleFont:source('userBubbleFontUrl'),
    aiBubbleFont:source('aiBubbleFontUrl')
  };
  try{
    await updateConversation(current.id,{presetId,model,multiBubble:$('multiBubble').checked,appearance,imageRetention:$('imageRetention')?.value||'5-turns',autoTranslate:!!$('autoTranslate')?.checked,imageGenerationEnabled:!!$('imageGenerationEnabled')?.checked});
    applyAppearance();
    await reloadRoomMessagesV3()
  }catch(error){toast('保存设置失败：'+error.message,'error')}
}
function bindBubbleControlsV16(){
  const width=$('bubbleWidth'),fontSize=$('bubbleFontSize');
  if(width){width.oninput=applyBubblePreviewV16;width.onchange=saveConversationSettingsV16}
  if(fontSize){fontSize.oninput=applyBubblePreviewV16;fontSize.onchange=saveConversationSettingsV16}
}
function trimRightModelPickerV16(){
  const label=$('rightModelPickerLabelV12');
  if(label)label.title=label.textContent.trim()
}
const applyAppearanceV16Base=applyAppearance;
applyAppearance=function(){
  applyAppearanceV16Base();
  const appearance=roomAppearanceV14();
  document.documentElement.style.setProperty('--chat-bubble-max-width',`${roomNumberV16(appearance.bubbleWidth,45,100,75)}%`);
  document.documentElement.style.setProperty('--chat-bubble-font-size',`${roomNumberV16(appearance.bubbleFontSize,12,24,16)}px`)
};
const hydrateRightV16Base=hydrateRight;
hydrateRight=function(){
  hydrateRightV16Base();
  hydrateBubbleControlsV16();
  bindBubbleControlsV16();
  trimRightModelPickerV16();
  applyAppearance()
};
function enhanceRoomAppearanceV16(){
  injectRoomAppearanceStylesV16();
  hydrateBubbleControlsV16();
  bindBubbleControlsV16();
  trimRightModelPickerV16();
  applyAppearance()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceRoomAppearanceV16);else enhanceRoomAppearanceV16();

// Role-level tool allowlist in the right drawer.
const TOOL_GROUPS_V17=[['记忆',['read_memories','search_memories','add_memory','update_memory','delete_memory'],['读取长期记忆','搜索长期记忆','写入记忆（长期 / 日常 / 日记）','编辑已有记忆','删除长期记忆']],['自我档案',['read_self_profile','update_self_profile'],['读取自我档案','更新自我档案']],['心情与经期',['read_moods','save_mood'],['读取心情/经期记录','记录当天心情']],['日程',['read_calendar','add_calendar_event','update_calendar_event','delete_calendar_event'],['读取日程','新增日程','编辑日程','删除日程']],['信箱',['read_letters','write_letter'],['读取信箱','写信']],['聊天动作',['quote_user_message','recall_own_message'],['引用我的消息','撤回 TA 的旧消息']],['生图',['generate_image'],['生成图片']]];
function toolRoleV17(){return roles.find(role=>role.id===current?.roleId)||null}function toolConfigV17(value){const raw=value&&typeof value==='object'?value:{};return{enabled:raw.enabled!==false,mode:raw.mode==='all'?'all':'custom',allowed:Array.isArray(raw.allowed)?raw.allowed:[]}}
async function persistToolConfigV17(config){const role=toolRoleV17();if(!role)return;const saved=await api('/api/chat/roles/'+encodeURIComponent(role.id),{method:'PUT',body:JSON.stringify({toolConfig:config})});const i=roles.findIndex(item=>item.id===role.id);if(i>=0)roles[i]=saved;renderToolManagerV17();toast('工具设置已保存','success')}
function renderToolManagerV17(){const panel=$('rightMenuPanel-toolsV17');if(!panel)return;const role=toolRoleV17();if(!role){panel.innerHTML='<p class="tool-note-v17">当前对话还没有绑定角色。</p>';return}const config=toolConfigV17(role.toolConfig);const rows=(names,labels)=>names.map((name,i)=>'<label class="tool-choice-v17"><span>'+labels[i]+'<small>'+name+'</small></span><input type="checkbox" data-tool="'+name+'" '+(config.mode==='all'||config.allowed.includes(name)?'checked':'')+' '+(!config.enabled||config.mode==='all'?'disabled':'')+'></label>').join('');panel.innerHTML='<div class="tool-head-v17"><strong>'+esc(role.name||'当前 TA')+'</strong><small>角色级设置，所有房间生效</small></div><label class="setting-row tool-switch-v17"><span>允许 TA 调用工具<small>关闭后不注入任何工具</small></span><input class="switch" id="toolMasterV17" type="checkbox" '+(config.enabled?'checked':'')+'></label><label class="setting-row tool-switch-v17"><span>全部工具<small>关闭后可按分类选择</small></span><input class="switch" id="toolAllV17" type="checkbox" '+(config.mode==='all'?'checked':'')+' '+(!config.enabled?'disabled':'')+'></label><div class="tool-groups-v17">'+TOOL_GROUPS_V17.map(g=>'<details><summary>'+g[0]+'</summary>'+rows(g[1],g[2])+'</details>').join('')+'</div>';const save=()=>persistToolConfigV17({enabled:$('toolMasterV17').checked,mode:$('toolAllV17').checked?'all':'custom',allowed:[...panel.querySelectorAll('[data-tool]:checked')].map(input=>input.dataset.tool)}).catch(e=>toast('保存失败：'+e.message,'error'));$('toolMasterV17').onchange=save;$('toolAllV17').onchange=save;panel.querySelectorAll('[data-tool]').forEach(input=>input.onchange=save)}
function ensureToolManagerV17(){const root=$('rightSettingsMenuV12');if(!root||$('rightMenuPanel-toolsV17'))return;root.insertAdjacentHTML('beforeend','<section class="right-menu-section" data-right-section="toolsV17"><button type="button" class="right-menu-summary" aria-expanded="false" data-tools-toggle-v17><span class="right-menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 6.3 3-3a4.1 4.1 0 0 0-5.2 5.2l-7.7 7.7a2.2 2.2 0 0 0 3.1 3.1l7.7-7.7a4.1 4.1 0 0 0 5.2-5.2l-3 3-3.1-3.1Z"/></svg></span><span>工具</span><svg class="right-menu-chevron" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button><div class="right-menu-panel" id="rightMenuPanel-toolsV17"></div></section>');root.querySelector('[data-tools-toggle-v17]').onclick=function(){const open=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!open));if(!open)renderToolManagerV17()};renderToolManagerV17()}
function toolStylesV17(){if($('toolStylesV17'))return;document.head.insertAdjacentHTML('beforeend','<style id="toolStylesV17">.tool-head-v17,.tool-switch-v17 span,.tool-choice-v17 span{display:grid;gap:2px}.tool-head-v17{margin:4px 0 10px}.tool-head-v17 small,.tool-note-v17,.tool-choice-v17 small{color:var(--chat-muted);font-size:11px}.tool-groups-v17{display:grid;gap:6px}.tool-groups-v17 details{border:1px solid var(--chat-border);border-radius:10px;padding:0 9px}.tool-groups-v17 summary{padding:9px 0;cursor:pointer;font-size:13px}.tool-choice-v17{display:flex;justify-content:space-between;align-items:center;gap:9px;padding:8px 0;border-top:1px solid var(--chat-border);font-size:12px}.tool-choice-v17 input{accent-color:var(--chat-accent)}</style>')}
const hydrateRightV17Base=hydrateRight;hydrateRight=function(){hydrateRightV17Base();toolStylesV17();ensureToolManagerV17();renderToolManagerV17()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{toolStylesV17();ensureToolManagerV17()});else{toolStylesV17();ensureToolManagerV17()}

/* V18: clearer model selection, role-grouped archives, and compact home control. */
function injectChatPolishV18(){
  if($('chatPolishV18'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="chatPolishV18">.top-bar-home{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;color:var(--chat-accent)}.top-bar-home svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.top-bar-home:hover{background:var(--accent-pale)}.right-model-choice.current{border-color:var(--chat-accent);background:var(--accent-pale);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--chat-accent) 24%,transparent)}.right-model-choice.current strong{color:var(--chat-accent)}.right-model-current-badge{display:inline-flex;align-items:center;margin-top:6px;padding:2px 7px;border-radius:999px;background:var(--chat-accent);color:var(--accent-contrast);font-size:10px;line-height:1.3}.right-model-choice.current svg{stroke:var(--chat-accent)}.archive-role-group-v18{margin:0 0 9px;border:1px solid var(--chat-border);border-radius:12px;background:var(--chat-bg);overflow:hidden}.archive-role-group-v18 summary{display:flex;align-items:center;gap:9px;min-height:52px;padding:8px 11px;cursor:pointer;list-style:none}.archive-role-group-v18 summary::-webkit-details-marker{display:none}.archive-role-group-v18 summary:after{content:"⌄";margin-left:auto;color:var(--chat-muted);font-size:19px;line-height:1;transition:transform .18s}.archive-role-group-v18[open] summary:after{transform:rotate(180deg)}.archive-role-avatar-v18{width:32px;height:32px;border:1px solid var(--accent-light);border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--accent-pale);color:var(--chat-accent);font:15px var(--font-d);flex:none}.archive-role-avatar-v18 img{width:100%;height:100%;object-fit:contain;background:var(--chat-surface)}.archive-role-name-v18{min-width:0;display:grid;gap:2px;color:var(--chat-text);font-size:13px}.archive-role-name-v18 small{color:var(--chat-muted);font-size:11px}.archive-role-list-v18{padding:0 9px 9px;border-top:1px solid var(--chat-border)}.archive-role-list-v18 .role-card{padding:10px 2px;border-bottom:1px solid var(--chat-border)}.archive-role-list-v18 .role-card:last-child{border-bottom:0}</style>');
}
let choosingConversationModelV18=false;
chooseConversationModelV12=async function(presetId='',model=''){
  const select=$('conversationModel');
  if(!select||!current||choosingConversationModelV18)return;
  choosingConversationModelV18=true;
  select.value=presetId&&model?presetId+'::'+model:'';
  try{
    await saveConversationSettingsV16();
    setModelPickerLabelV12();
    closeModelSheetV12();
  }finally{choosingConversationModelV18=false}
};
const openModelSheetV18Base=openModelSheetV12;
openModelSheetV12=function(presetId=''){
  openModelSheetV18Base(presetId);
  if(!presetId)return;
  const list=$('rightModelSheetListV12');
  list?.querySelectorAll('[data-model-value]').forEach(button=>{
    const selected=current?.presetId===presetId&&current?.model===button.dataset.modelValue;
    button.classList.toggle('current',selected);
    button.setAttribute('aria-current',selected?'true':'false');
    if(selected&&!button.querySelector('.right-model-current-badge'))button.querySelector('span')?.insertAdjacentHTML('beforeend','<small class="right-model-current-badge">当前使用</small>');
  });
};
function renderArchiveV18(){
  const container=$('archiveList');if(!container)return;
  const archived=conversations.filter(item=>item.archived);
  if(!archived.length){container.innerHTML='<div class="empty-note">暂无归档对话</div>';return}
  const groups=new Map();
  archived.forEach(conversation=>{
    const role=roles.find(item=>item.id===conversation.roleId)||null;
    const key=role?.id||'unassigned';
    if(!groups.has(key))groups.set(key,{role,items:[]});
    groups.get(key).items.push(conversation);
  });
  container.innerHTML=[...groups.values()].map(({role,items})=>{
    items.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    const name=role?.name||'未绑定角色';
    const avatar=role?roleAvatar(role):'…';
    return '<details class="archive-role-group-v18"><summary><span class="archive-role-avatar-v18">'+avatar+'</span><span class="archive-role-name-v18"><strong>'+esc(name)+'</strong><small>'+items.length+' 个已归档对话</small></span></summary><div class="archive-role-list-v18">'+items.map(c=>'<div class="role-card"><div class="role-info"><strong>'+esc(c.title||'未命名对话')+'</strong><p>'+new Date(c.updatedAt).toLocaleDateString('zh-CN')+'</p></div><button class="btn btn-outline restore-chat" data-id="'+esc(c.id)+'">恢复</button></div>').join('')+'</div></details>';
  }).join('');
  container.querySelectorAll('.restore-chat').forEach(button=>button.onclick=async()=>{await updateConversation(button.dataset.id,{archived:false});renderArchive();renderConversations()});
}
renderArchive=renderArchiveV18;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectChatPolishV18);else injectChatPolishV18();

/* V20: reliable reply loading, paged history, and a compact three-card photo deck. */
const HISTORY_PAGE_SIZE_V20=80;
let replyLoadingV20=null,historyConversationIdV20='',historyLoadingV20=false,historyHasMoreV20=false;
function mergeMessagesV20(...lists){
  const byId=new Map();
  lists.flat().forEach(message=>{if(message?.id!=null)byId.set(String(message.id),message)});
  return [...byId.values()].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
}
function resetHistoryV20(){historyConversationIdV20=current?.id||'';historyLoadingV20=false;historyHasMoreV20=messages.length>=100}
function typingMarkupV20(){return '<div class="message-group assistant typing-group reply-loading-v20" id="typing"><div class="avatar-stack"><div class="avatar">'+roleAvatar(roles.find(role=>role.id===current?.roleId))+'</div></div><div class="bubble-stack"><div class="bubble typing"><i></i><i></i><i></i></div></div></div>'}
const updateReplyButtonV20Base=updateReplyButton;
updateReplyButton=function(){
  updateReplyButtonV20Base();
  const button=$('askReplyBtn');
  if(button)button.disabled=button.disabled||savingBubble||!!replyLoadingV20;
};
const renderMessagesV20Base=renderMessages;
renderMessages=function(){
  renderMessagesV20Base();
  const list=$('messages');
  if(!list||!current)return;
  if(historyConversationIdV20===current.id&&historyHasMoreV20){
    list.insertAdjacentHTML('afterbegin','<button type="button" class="chat-history-load-v20" data-load-earlier-v20 '+(historyLoadingV20?'disabled':'')+'>'+ (historyLoadingV20?'正在加载更早消息…':'加载更早消息') +'</button>');
  }
  if(replyLoadingV20?.conversationId===current.id)list.insertAdjacentHTML('beforeend',typingMarkupV20());
};
async function loadEarlierMessagesV20(){
  if(historyLoadingV20||!historyHasMoreV20||!current||historyConversationIdV20!==current.id||!messages.length)return;
  const oldest=messages[0],main=$('chatMain');
  historyLoadingV20=true;renderMessages();
  const oldHeight=main.scrollHeight,oldTop=main.scrollTop;
  try{
    const data=await api('/api/chat/messages?conversationId='+encodeURIComponent(current.id)+'&limit='+HISTORY_PAGE_SIZE_V20+'&beforeId='+encodeURIComponent(oldest.id));
    const earlier=data.messages||[];
    messages=mergeMessagesV20(earlier,messages);
    historyHasMoreV20=!!data.hasMore;
    renderMessages();
    requestAnimationFrame(()=>{main.scrollTop=Math.max(0,main.scrollHeight-oldHeight+oldTop)});
  }catch(error){toast('加载更早消息失败：'+error.message,'error')}
  finally{historyLoadingV20=false;renderMessages()}
}
async function syncOpenRoomV20(){
  if(roomSyncBusyV5||savingBubble||sending||!current||document.hidden)return;
  roomSyncBusyV5=true;
  try{
    const data=await api('/api/chat/messages?conversationId='+encodeURIComponent(current.id)+'&limit=100'),next=data.messages||[];
    const currentTail=messages.slice(-100);
    if(roomMessageStateV5(next)!==roomMessageStateV5(currentTail)){
      const main=$('chatMain'),nearBottom=main&&main.scrollHeight-main.scrollTop-main.clientHeight<150;
      messages=mergeMessagesV20(messages,next);
      pendingTurnGroupId=getPendingTurnGroupId(messages);
      renderMessages();if(nearBottom)scrollBottom();
    }
  }catch{}finally{roomSyncBusyV5=false}
}
syncOpenRoomV5=syncOpenRoomV20;
async function revealAiMessagesV20(aiMessages,baseMessages){
  messages=baseMessages;
  for(const message of aiMessages){
    replyLoadingV20={conversationId:current?.id||''};renderMessages();scrollBottom();
    const pause=Math.min(1500,Math.max(600,350+String(message.content||'').length*16));
    await sleep(pause);
    replyLoadingV20=null;messages.push(message);renderMessages();scrollBottom();
  }
}
async function requestAiReplyV20(){
  if(sending||!current)return;
  if(savingBubble){toast('消息正在发送，稍候再让 TA 回复');return}
  const groupId=pendingTurnGroupId||getPendingTurnGroupId(messages);
  const userTurn=messages.filter(message=>message.role==='iris'&&message.replyGroupId===groupId);
  if(!groupId||!userTurn.length)return toast('先发一条消息吧');
  sending=true;replyLoadingV20={conversationId:current.id};updateReplyButton();renderMessages();scrollBottom();
  try{
    const data=await api('/api/chat/send',{method:'POST',body:JSON.stringify({conversationId:current.id,replyGroupId:groupId,settings})});
    const base=messages.slice();
    for(const message of data.userMessages||[])if(!base.some(item=>item.id===message.id))base.push(message);
    await revealAiMessagesV20(data.aiMessages||[],base);
    pendingTurnGroupId='';await refreshConversationMeta();
  }catch(error){
    const delayed=/504|timeout|network|failed to fetch/i.test(error.message||'');
    replyLoadingV20=null;
    const systemMessages=Array.isArray(error.data?.systemMessages)?error.data.systemMessages:[];
    if(systemMessages.length){
      messages=mergeMessagesV20(messages,systemMessages);
      renderMessages();
      toast('回复未完成，失败原因与已保存的工具记录已写入聊天','error');
    }else{
      if(delayed)toast('连接较慢，回复若完成会自动出现');else toast('发送失败：'+error.message,'error');
      try{await syncOpenRoomV20()}catch{}
    }
    pendingTurnGroupId=getPendingTurnGroupId(messages);
  }finally{replyLoadingV20=null;sending=false;updateReplyButton();renderMessages();scrollBottom()}
}
requestAiReply=requestAiReplyV20;

/* V30: durable tool audit and local failure notices.  System notices are
   stored by the server, never sent back to the model as conversation text. */
function groupMessagesV30(list){
  const groups=[];
  for(const message of list){
    if(message.recalled||message.role==='system'){
      groups.push({groupId:'',role:'system',isSystem:true,messages:[message],last:message});
      continue;
    }
    const previous=groups[groups.length-1],groupId=message.replyGroupId||'',sameDay=previous&&!previous.isSystem&&messageDateKey(message.createdAt)===messageDateKey(previous.last.createdAt),sameExplicit=previous&&sameDay&&groupId&&previous.groupId===groupId&&previous.role===message.role,sameLegacy=previous&&sameDay&&!groupId&&!previous.groupId&&previous.role===message.role&&Math.abs(new Date(message.createdAt)-new Date(previous.last.createdAt))<=30000;
    if((sameExplicit||sameLegacy)&&current?.mergeBubbles!==false){previous.messages.push(message);previous.last=message}else groups.push({groupId,role:message.role,messages:[message],last:message});
  }
  return groups;
}
groupMessages=groupMessagesV30;
getPendingTurnGroupId=function(list=messages){
  const last=[...groupMessages(list)].reverse().find(group=>!group.isSystem);
  return last?.role==='iris'?(last.groupId||''):'';
};
function systemMessageLabelV30(message){
  if(message?.systemType==='chat_failure')return String(message.content||'本次回复未完成');
  if(message?.systemType==='listening_invitation_response'){
    const event=message.listeningInvitationResponse||{},decision=event.decision;
    if(event.actor==='iris')return decision==='accept'?'你同意了一起听歌':decision==='decline'?'你拒绝了一起听歌':'你回应了一起听邀请';
    const name=typeof companionRoleNameV34==='function'?String(companionRoleNameV34()||'TA'):String(event.roleName||'TA');
    return decision==='accept'?name+' 同意了一起听歌':decision==='decline'?name+' 拒绝了一起听歌':'一起听邀请已更新';
  }
  return recalledMessageLabelV4(message);
}
function systemMessageMarkupV30(message){
  const calls=Array.isArray(message?.toolCalls)?message.toolCalls:[];
  const details=calls.length?'<button type="button" class="system-tool-audit-v30" data-turn-insight="tools" data-message-id="'+esc(String(message.id||''))+'">查看已保存的 '+calls.length+' 条工具记录</button>':'';
  return '<div class="chat-message-system chat-message-system-v30" data-message-id="'+esc(String(message.id||''))+'"><span>'+esc(systemMessageLabelV30(message))+'</span>'+details+'</div>';
}
const renderGroupV30Base=renderGroup;
renderGroup=function(group,role){
  if(group?.isSystem)return systemMessageMarkupV30(group.messages[0]);
  return renderGroupV30Base(group,role);
};
function injectSystemAuditStylesV30(){
  if($('systemAuditStylesV30'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="systemAuditStylesV30">.chat-message-system-v30{flex-direction:column;align-items:center;gap:5px;margin:5px 0}.chat-message-system-v30 span{max-width:min(620px,88vw);white-space:normal;text-align:center;line-height:1.45}.system-tool-audit-v30{border:0;background:transparent;color:var(--chat-accent);font:12px var(--font-b);cursor:pointer;text-decoration:underline;text-underline-offset:3px}</style>');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectSystemAuditStylesV30);else injectSystemAuditStylesV30();
const openConversationV20Base=openConversation;
openConversation=async function(id){replyLoadingV20=null;historyConversationIdV20='';historyHasMoreV20=false;await openConversationV20Base(id);resetHistoryV20();renderMessages()};
const reloadRoomMessagesV20Base=reloadRoomMessagesV3;
reloadRoomMessagesV3=async function(){await reloadRoomMessagesV20Base();resetHistoryV20();renderMessages()};
function photoStackPoseV20(position){
  const poses=[{x:0,y:0,r:-0.7},{x:12,y:-1,r:0.5},{x:24,y:1,r:1}];
  return poses[Math.min(2,Math.max(0,Number(position)||0))];
}
photoCardMarkup=function(src,index,count,messageId,extraClass){
  const pose=photoStackPoseV20(index);
  return '<button type="button" class="chat-photo-card '+(extraClass||'')+'" data-photo-open-v2 data-photo-message-id="'+esc(messageId)+'" data-photo-index="'+index+'" data-photo-active="'+(index===0)+'" style="--photo-offset:'+pose.x+'px;--photo-lift:'+pose.y+'px;--photo-rotate:'+pose.r+'deg;--photo-layer:'+(count-index)+'" aria-label="查看第 '+(index+1)+' 张图片"><img src="'+esc(src)+'" alt="图片 '+(index+1)+'"></button>';
};
photoStackMarkupV2=function(message){
  const images=chatImages(message);if(!images.length)return '';
  const messageId=photoMessageId(message);
  if(images.length===1)return '<button type="button" class="chat-photo-single chat-photo-single-v2" data-photo-open-v2 data-photo-message-id="'+esc(messageId)+'" data-photo-index="0" aria-label="查看图片"><img src="'+esc(images[0])+'" alt="发送的图片"></button>';
  const cards=images.map((src,index)=>photoCardMarkup(src,index,images.length,messageId,'chat-photo-stack-card')).join('');
  const expanded=images.map((src,index)=>'<button type="button" class="chat-photo-expanded-item" data-photo-open-v2 data-photo-message-id="'+esc(messageId)+'" data-photo-index="'+index+'" aria-label="查看第 '+(index+1)+' 张图片"><img src="'+esc(src)+'" alt="图片 '+(index+1)+'"><span>'+ (index+1)+' / '+images.length+'</span></button>').join('');
  return '<section class="chat-photo-group" data-photo-group data-photo-message-id="'+esc(messageId)+'" data-photo-index="0" data-expanded="false"><div class="chat-photo-stack-shell"><div class="chat-photo-stack-stage" style="--photo-stack-width:200px" aria-label="'+images.length+' 张图片，左右滑动浏览"><div class="chat-photo-stack-deck">'+cards+'</div></div></div><button type="button" class="chat-photo-group-toggle" data-photo-toggle aria-expanded="false">展开 '+images.length+'</button><div class="chat-photo-expanded-list">'+expanded+'</div></section>';
};
setPhotoGroupIndex=function(group,nextIndex){
  if(!group)return;const cards=Array.from(group.querySelectorAll('.chat-photo-stack-card')),count=cards.length;if(!count)return;
  const active=((Number(nextIndex)%count)+count)%count;group.dataset.photoIndex=String(active);
  cards.forEach(card=>{const position=(Number(card.dataset.photoIndex)-active+count)%count,pose=photoStackPoseV20(position);card.style.setProperty('--photo-offset',pose.x+'px');card.style.setProperty('--photo-lift',pose.y+'px');card.style.setProperty('--photo-rotate',pose.r+'deg');card.style.setProperty('--photo-layer',String(count-position));card.dataset.photoActive=String(position===0)});
};
function injectChatFixesV20Styles(){
  if($('chatFixesV20Styles'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="chatFixesV20Styles">.chat-history-load-v20{align-self:center;margin:1px 0 9px;padding:6px 11px;border:1px solid var(--chat-border);border-radius:999px;background:var(--chat-surface);color:var(--chat-muted);font:12px var(--font-b);cursor:pointer}.chat-history-load-v20:disabled{opacity:.58;cursor:wait}.chat-photo-group{gap:0 7px!important}.chat-photo-stack-stage{width:min(var(--photo-stack-width),56vw)!important;height:min(205px,55vw)!important;min-height:145px!important}.chat-photo-card{width:min(176px,48vw)!important;box-shadow:0 2px 7px rgba(73,53,38,.11)!important;transform:translate(var(--photo-offset,0px),var(--photo-lift,0px)) rotate(var(--photo-rotate,0deg))!important;transform-origin:center bottom!important}.chat-photo-card[data-photo-active="true"]{box-shadow:0 3px 9px rgba(73,53,38,.14)!important}.chat-photo-stack-deck{position:relative;width:100%;height:100%}</style>');
}
function enhanceChatFixesV20(){
  injectChatFixesV20Styles();
  $('askReplyBtn').onclick=requestAiReplyV20;
  const main=$('chatMain');
  if(main&&!main.dataset.historyPagingV20){main.dataset.historyPagingV20='true';main.addEventListener('scroll',()=>{if(main.scrollHeight>main.clientHeight+100&&main.scrollTop<70)loadEarlierMessagesV20()})}
  if(!document.documentElement.dataset.historyPagingV20){document.documentElement.dataset.historyPagingV20='true';document.addEventListener('click',event=>{if(event.target.closest('[data-load-earlier-v20]'))loadEarlierMessagesV20()})}
  renderMessages();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceChatFixesV20);else enhanceChatFixesV20();

/* V21: room-aware English composer prompt, copy action, and jump-to-latest. */
function syncComposerPlaceholderV21(){
  const input=$('chatInput');if(!input)return;
  const role=roles.find(item=>item.id===current?.roleId);
  input.placeholder=current?`Message ${String(role?.name||'them').trim()||'them'}…`:'Start a conversation…';
}
function ensureJumpToLatestV21(){
  if($('jumpToLatestV21'))return;
  document.body.insertAdjacentHTML('beforeend','<button type="button" class="chat-jump-latest-v21" id="jumpToLatestV21" aria-label="回到最新消息" title="回到最新消息"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v12m0 0 5-5m-5 5-5-5M5 20h14"/></svg></button>');
  $('jumpToLatestV21').onclick=()=>{const main=$('chatMain');if(main)main.scrollTo({top:main.scrollHeight,behavior:'smooth'})};
}
function syncJumpToLatestV21(){
  const button=$('jumpToLatestV21'),main=$('chatMain');if(!button||!main)return;
  const away=main.scrollHeight-main.scrollTop-main.clientHeight>180;
  button.classList.toggle('show',!!current&&away);
}
function injectChatFixesV21Styles(){
  if($('chatFixesV21Styles'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="chatFixesV21Styles">.chat-jump-latest-v21{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:88px;z-index:155;display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid var(--chat-border);border-radius:50%;background:color-mix(in srgb,var(--chat-surface) 92%,transparent);color:var(--chat-text);box-shadow:var(--shadow-sm);backdrop-filter:blur(12px);opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease,visibility .18s;cursor:pointer}.chat-jump-latest-v21.show{opacity:1;visibility:visible;transform:none}.chat-jump-latest-v21 svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.chat-jump-latest-v21:active{background:var(--accent-pale);color:var(--chat-accent)}@media(min-width:700px){.chat-jump-latest-v21{right:max(24px,calc((100vw - 820px)/2 + 14px))}}</style>');
}
const showLandingV21Base=showLanding;
showLanding=function(){showLandingV21Base();syncComposerPlaceholderV21();syncJumpToLatestV21()};
const openConversationV21Base=openConversation;
openConversation=async function(id){await openConversationV21Base(id);syncComposerPlaceholderV21();syncJumpToLatestV21()};
const renderMessagesV21Base=renderMessages;
renderMessages=function(){renderMessagesV21Base();requestAnimationFrame(syncJumpToLatestV21)};
function enhanceChatFixesV21(){
  injectChatFixesV21Styles();ensureJumpToLatestV21();syncComposerPlaceholderV21();
  const main=$('chatMain');if(main&&!main.dataset.jumpLatestV21){main.dataset.jumpLatestV21='true';main.addEventListener('scroll',syncJumpToLatestV21,{passive:true})}
  syncJumpToLatestV21();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceChatFixesV21);else enhanceChatFixesV21();

/* V22: restore the last room and keep the chat stable around mobile keyboards. */
const LAST_OPEN_ROOM_KEY_V22='iris-last-open-room';
function syncMobileViewportV22(){
  const viewport=window.visualViewport,root=document.documentElement;
  if(!viewport){root.style.setProperty('--chat-vv-top','0px');root.style.setProperty('--chat-keyboard','0px');return}
  const top=Math.max(0,Math.round(viewport.offsetTop||0));
  const layoutHeight=Math.max(document.documentElement.clientHeight||0,window.innerHeight||0);
  const keyboard=Math.max(0,Math.round(layoutHeight-viewport.height-top));
  root.style.setProperty('--chat-vv-top',top+'px');
  root.style.setProperty('--chat-keyboard',keyboard+'px');
}
let keyboardScrollTimerV22=0;
function scrollLatestForKeyboardV22(){
  if(!current||document.activeElement!==$('chatInput'))return;
  requestAnimationFrame(scrollBottom);
  clearTimeout(keyboardScrollTimerV22);
  keyboardScrollTimerV22=setTimeout(()=>{if(document.activeElement===$('chatInput'))scrollBottom()},260);
}
function injectChatFixesV22Styles(){
  if($('chatFixesV22Styles'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="chatFixesV22Styles">.chat-room{--chat-head-height:58px}.chat-room .chat-head{top:var(--chat-vv-top,0px)!important}.chat-room .chat-main{top:calc(var(--chat-head-height) + var(--chat-vv-top,0px))!important}.chat-room .composer{bottom:var(--chat-keyboard,0px)!important}@media(max-width:540px){.chat-room{--chat-head-height:54px}}</style>');
}
const openConversationV22Base=openConversation;
openConversation=async function(id){
  await openConversationV22Base(id);
  if(current?.id)localStorage.setItem(LAST_OPEN_ROOM_KEY_V22,current.id);
  syncMobileViewportV22();
};
const sendUserBubbleV22Base=sendUserBubble;
sendUserBubble=async function(){
  const input=$('chatInput');
  const shouldKeepTyping=!!current&&!!input&&(input.value.trim()||pendingImages?.length);
  const result=sendUserBubbleV22Base();
  if(shouldKeepTyping)requestAnimationFrame(()=>input.focus({preventScroll:true}));
  try{return await result}finally{if(shouldKeepTyping)requestAnimationFrame(()=>input.focus({preventScroll:true}))}
};
const initV22Base=init;
init=async function(){
  await initV22Base();
  const lastId=localStorage.getItem(LAST_OPEN_ROOM_KEY_V22);
  if(lastId&&conversations.some(item=>item.id===lastId&&!item.archived))await openConversation(lastId);
};
function enhanceChatFixesV22(){
  injectChatFixesV22Styles();syncMobileViewportV22();
  const viewport=window.visualViewport;
  if(viewport&&!window.__chatViewportV22Bound){window.__chatViewportV22Bound=true;viewport.addEventListener('resize',()=>{syncMobileViewportV22();scrollLatestForKeyboardV22()});viewport.addEventListener('scroll',syncMobileViewportV22)}
  if(!document.documentElement.dataset.chatViewportV22){
    document.documentElement.dataset.chatViewportV22='true';
    window.addEventListener('resize',syncMobileViewportV22);
    window.addEventListener('pagehide',()=>{if(current?.id)localStorage.setItem(LAST_OPEN_ROOM_KEY_V22,current.id)});
    $('chatInput').addEventListener('focus',scrollLatestForKeyboardV22);
    $('sendBtn').onclick=sendUserBubble;
    $('newChatBtn').onclick=()=>{localStorage.removeItem(LAST_OPEN_ROOM_KEY_V22);showLanding()};
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceChatFixesV22);else enhanceChatFixesV22();

/* V24: Companion entry lives in the current chat room's right drawer. */
const COMPANION_SCENES_V24=[
  ['study','✦','学习'],['vocabulary','▤','背单词'],['exercise','◌','运动'],
  ['sleep','☾','睡眠'],['bath','⌇','沐浴'],['custom','＋','自定义']
];
let companionSceneV24='study',companionTimerModeV24='countdown';
function companionIconV24(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z"/><path d="M16.5 4.5v3M15 6h3"/></svg>'}
function injectCompanionV24Styles(){if($('companionStylesV24'))return;document.head.insertAdjacentHTML('beforeend','<style id="companionStylesV24">'+
  '.right-menu-companion-v24{padding:10px 0;border-bottom:1px solid var(--chat-border)}.companion-entry-v24{display:flex;align-items:center;gap:11px;width:100%;padding:10px 3px;border:0;background:transparent;color:var(--chat-text);font:400 15px var(--font-b);text-align:left;cursor:pointer}.companion-entry-v24:active{background:var(--accent-pale)}.companion-entry-v24 i{display:grid;place-items:center;width:28px;height:28px;color:var(--chat-accent)}.companion-entry-v24 i svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.companion-entry-v24 small{margin-left:auto;color:var(--chat-muted);font:13px var(--font-b)}'+
  '.companion-picker-v24{position:fixed;inset:0;z-index:1200;display:none;align-items:flex-end;background:rgba(45,37,39,.28);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}.companion-picker-v24.open{display:flex}.companion-picker-card-v24{box-sizing:border-box;width:100%;max-height:88vh;padding:10px 18px calc(22px + env(safe-area-inset-bottom));overflow:auto;border-radius:28px 28px 0 0;background:var(--chat-surface);box-shadow:0 -10px 35px rgba(var(--shadow-color),.16)}.companion-picker-grab-v24{width:38px;height:5px;margin:0 auto 15px;border-radius:99px;background:color-mix(in srgb,var(--chat-muted) 30%,transparent)}.companion-picker-head-v24{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.companion-picker-head-v24 h2{margin:0;color:var(--chat-text);font:400 26px var(--font-d)}.companion-picker-close-v24{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--chat-muted);font-size:25px;cursor:pointer}.companion-scene-grid-v24{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.companion-scene-v24{min-height:98px;padding:10px 4px;border:1px solid var(--chat-border);border-radius:16px;background:var(--chat-bg);color:var(--chat-text);font:400 15px var(--font-b);cursor:pointer}.companion-scene-v24 span{display:grid;place-items:center;height:39px;color:var(--chat-accent);font:400 27px var(--font-d)}.companion-scene-v24 b{display:block;margin-top:7px;font-weight:400}.companion-scene-v24.selected{border-color:var(--chat-accent);background:var(--accent-pale);box-shadow:0 0 0 1px var(--chat-accent)}.companion-setup-v24{margin-top:19px;padding-top:15px;border-top:1px solid var(--chat-border)}.companion-setup-title-v24{margin:0 0 11px;color:var(--chat-text);font:400 18px var(--font-d)}.companion-field-v24{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:11px 0;color:var(--chat-muted);font:13px var(--font-b)}.companion-field-v24 select,.companion-field-v24 input[type=number]{max-width:168px;padding:8px 9px;border:1px solid var(--chat-border);border-radius:10px;background:var(--chat-bg);color:var(--chat-text);font:13px var(--font-b)}.companion-choice-v24{display:flex;gap:7px}.companion-choice-v24 button{padding:7px 10px;border:1px solid var(--chat-border);border-radius:10px;background:var(--chat-bg);color:var(--chat-muted);font:12px var(--font-b);cursor:pointer}.companion-choice-v24 button.on{border-color:var(--chat-accent);background:var(--accent-pale);color:var(--chat-text)}.companion-start-v24{width:100%;margin-top:15px;padding:13px;border:0;border-radius:14px;background:var(--chat-accent);color:var(--accent-contrast);font:400 15px var(--font-b);cursor:pointer}.companion-start-v24:disabled{opacity:.55}@media(min-width:700px){.companion-picker-v24{align-items:center;justify-content:center}.companion-picker-card-v24{width:min(520px,94vw);border-radius:24px;padding-bottom:22px}}</style>');}
function ensureCompanionPickerV24(){if($('companionPickerV24'))return;document.body.insertAdjacentHTML('beforeend','<section class="companion-picker-v24" id="companionPickerV24" aria-hidden="true"><div class="companion-picker-card-v24" role="dialog" aria-modal="true"><div class="companion-picker-grab-v24"></div><header class="companion-picker-head-v24"><h2>陪伴</h2><button type="button" class="companion-picker-close-v24" aria-label="关闭">×</button></header><div class="companion-scene-grid-v24" id="companionSceneGridV24"></div><section class="companion-setup-v24"><h3 class="companion-setup-title-v24" id="companionSetupTitleV24">学习陪伴</h3><div class="companion-field-v24" id="companionSleepModeV24"><span>计时方式</span><div class="companion-choice-v24"><button type="button" data-timer="countdown" class="on">倒计时</button><button type="button" data-timer="elapsed">正数计时</button></div></div><label class="companion-field-v24" id="companionDurationV24"><span>时长</span><select id="companionDurationSelectV24"><option value="25">25 分钟</option><option value="50">50 分钟</option><option value="90">90 分钟</option><option value="30">30 分钟</option><option value="60">60 分钟</option></select></label><label class="companion-field-v24"><span>白噪音</span><select id="companionAmbientV24"><option value="rain">雨声</option><option value="waves">海浪</option><option value="fire">壁炉</option><option value="cafe">咖啡馆</option><option value="wind">风声</option><option value="none">不播放</option></select></label><label class="companion-field-v24"><span>AI 主动关心</span><input type="checkbox" class="switch" id="companionAutoV24" checked></label><label class="companion-field-v24" id="companionIntervalV24"><span>间隔</span><select id="companionIntervalSelectV24"><option value="5">每 5 分钟</option><option value="10">每 10 分钟</option><option value="15">每 15 分钟</option><option value="30">每 30 分钟</option></select></label><label class="companion-field-v24" id="companionLimitV24"><span>最多主动次数</span><select id="companionLimitSelectV24"><option value="2">2 次</option><option value="4" selected>4 次</option><option value="6">6 次</option></select></label><button type="button" class="companion-start-v24" id="companionStartV24">开始一起待着</button></section></div></section>');const picker=$('companionPickerV24');picker.querySelector('.companion-picker-close-v24').onclick=()=>closeCompanionPickerV24();picker.onclick=e=>{if(e.target===picker)closeCompanionPickerV24()};$('companionAutoV24').onchange=syncCompanionSetupV24;$('companionStartV24').onclick=startCompanionV24;picker.querySelectorAll('[data-timer]').forEach(b=>b.onclick=()=>{companionTimerModeV24=b.dataset.timer;syncCompanionSetupV24()});renderCompanionScenesV24();syncCompanionSetupV24()}
function renderCompanionScenesV24(){const grid=$('companionSceneGridV24');if(!grid)return;grid.innerHTML=COMPANION_SCENES_V24.map(([id,mark,label])=>'<button type="button" class="companion-scene-v24 '+(id===companionSceneV24?'selected':'')+'" data-scene="'+id+'"><span>'+mark+'</span><b>'+label+'</b></button>').join('');grid.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{companionSceneV24=b.dataset.scene;if(companionSceneV24==='sleep')companionTimerModeV24='countdown';renderCompanionScenesV24();syncCompanionSetupV24()})}
function syncCompanionSetupV24(){const sleep=companionSceneV24==='sleep',elapsed=companionTimerModeV24==='elapsed',auto=$('companionAutoV24')?.checked;const names={study:'学习',vocabulary:'背单词',exercise:'运动',sleep:'睡眠',bath:'沐浴',custom:'自定义'};$('companionSetupTitleV24').textContent=(names[companionSceneV24]||'自定义')+'陪伴';$('companionSleepModeV24').style.display=sleep?'flex':'none';$('companionDurationV24').style.display=elapsed?'none':'flex';$('companionAutoV24').checked=sleep?false:$('companionAutoV24').checked;$('companionAutoV24').disabled=sleep;$('companionIntervalV24').style.display=auto&&!sleep?'flex':'none';$('companionLimitV24').style.display=auto&&!sleep?'flex':'none';document.querySelectorAll('[data-timer]').forEach(b=>b.classList.toggle('on',b.dataset.timer===companionTimerModeV24))}
function openCompanionPickerV24(){if(!current)return toast('请先进入一个聊天房间');ensureCompanionPickerV24();$('companionPickerV24').classList.add('open');$('companionPickerV24').setAttribute('aria-hidden','false');renderCompanionScenesV24();syncCompanionSetupV24()}
function closeCompanionPickerV24(){const picker=$('companionPickerV24');if(picker){picker.classList.remove('open');picker.setAttribute('aria-hidden','true')}}
async function startCompanionV24(){if(!current)return;const button=$('companionStartV24');button.disabled=true;try{const session=await api('/api/companion/sessions',{method:'POST',body:JSON.stringify({scene:companionSceneV24,name:($('companionSetupTitleV24').textContent||'陪伴'),timerMode:companionTimerModeV24,durationSeconds:Number($('companionDurationSelectV24').value||25)*60,ambient:$('companionAmbientV24').value,autoEnabled:$('companionAutoV24').checked&&! (companionSceneV24==='sleep'),autoIntervalMinutes:Number($('companionIntervalSelectV24').value||5),autoLimit:Number($('companionLimitSelectV24').value||4),sleepMode:companionTimerModeV24==='elapsed'?'night':'nap',roleId:current.roleId||'',conversationId:current.id})});location.href='companion.html?session='+encodeURIComponent(session.id)+'&chat='+encodeURIComponent(current.id)}catch(e){toast('创建陪伴房间失败：'+e.message,'error')}finally{button.disabled=false}}
function ensureCompanionEntryV24(){const root=$('rightSettingsMenuV12');if(!root)return;let entry=$('companionEntryV24');if(!entry){root.insertAdjacentHTML('beforeend','<section class="right-menu-companion-v24" id="companionEntryV24"><button type="button" class="companion-entry-v24" id="openCompanionV24"><i>'+companionIconV24()+'</i><span>陪伴</span><small>›</small></button></section>');entry=$('companionEntryV24');$('openCompanionV24').onclick=openCompanionPickerV24}const model=root.querySelector('.right-menu-model');if(model&&entry?.previousElementSibling!==model)model.insertAdjacentElement('afterend',entry)}
const hydrateRightV24Base=hydrateRight;hydrateRight=function(){hydrateRightV24Base();ensureCompanionEntryV24()};
function enhanceCompanionV24(){injectCompanionV24Styles();ensureCompanionPickerV24();ensureCompanionEntryV24()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceCompanionV24);else enhanceCompanionV24();

/* V23: per-turn native thinking and tool-call sheets. */
const TURN_TOOL_NAMES_V23={
  read_self_profile:'读取自我档案',update_self_profile:'更新自我档案',
  read_memories:'读取长期记忆',search_memories:'搜索长期记忆',add_memory:'写入记忆',update_memory:'编辑记忆',delete_memory:'删除记忆',
  read_moods:'读取心情 / 经期记录',save_mood:'记录当天心情',
  read_letters:'读取信箱',write_letter:'写信',
  read_calendar:'读取日程',add_calendar_event:'新增日程',update_calendar_event:'编辑日程',delete_calendar_event:'删除日程',
  quote_user_message:'引用我的消息',recall_own_message:'撤回 TA 的旧消息',generate_image:'生成图片'
};
function wrenchIconV23(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 6.1a5.1 5.1 0 0 0-6.7 6.6L3.4 17.4a2.15 2.15 0 1 0 3 3l4.7-4.7a5.1 5.1 0 0 0 6.6-6.7l-3.3 3.2-3.1-.8-.8-3.1 3.3-3.2Z"/></svg>'}
function thoughtIconV23(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.6v4.8l3.1 2.1"/><path d="M9 2.8h6"/></svg>'}
function staticInsightSheetV25(kind,message,id){
  const calls=Array.isArray(message?.toolCalls)?message.toolCalls:[];
  const reasoning=String(message?.reasoning||'').trim();
  const title=kind==='thinking'?'Thought process':'Tool calls';
  const body=kind==='thinking'
    ?'<p class="turn-thinking-copy-v23">'+esc(reasoning)+'</p>'
    :'<p class="turn-tool-intro-v23">This reply used '+calls.length+' tool'+(calls.length===1?'':'s')+'.</p>'+calls.map(toolCallMarkupV23).join('');
  return '<section class="turn-insight-sheet-v25" id="'+id+'" aria-labelledby="'+id+'-title"><a class="turn-insight-backdrop-v25" href="#turn-insight-close-v25" aria-label="关闭"></a><div class="turn-insight-panel-v25" role="dialog" aria-modal="true"><div class="turn-insight-grab-v23"></div><header><h2 id="'+id+'-title">'+title+'</h2><a class="turn-insight-close-v25" href="#turn-insight-close-v25" aria-label="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></a></header><div class="turn-insight-content-v23">'+body+'</div></div></section>';
}
function turnInsightButtonsV23(message){
  const calls=Array.isArray(message?.toolCalls)?message.toolCalls:[];
  const hasReasoning=!!String(message?.reasoning||'').trim();
  if(!calls.length&&!hasReasoning)return '';
  return '<div class="turn-insights-v23" aria-label="本轮详情">'+
    (calls.length?'<button type="button" class="turn-insight-trigger-v23" data-turn-insight="tools" data-message-id="'+esc(String(message.id||''))+'" aria-label="查看本轮 '+calls.length+' 次工具调用" title="工具调用">'+wrenchIconV23()+(calls.length>1?'<em>'+calls.length+'</em>':'')+'</button>':'')+
    (hasReasoning?'<button type="button" class="turn-insight-trigger-v23" data-turn-insight="thinking" data-message-id="'+esc(String(message.id||''))+'" aria-label="查看原生思考内容" title="思考过程">'+thoughtIconV23()+'</button>':'')+
  '</div>';
}
const renderGroupV23Base=renderGroup;
renderGroup=function(group,role){
  const markup=renderGroupV23Base(group,role);
  const first=group?.messages?.[0];
  if(group?.isSystem||group?.role==='iris'||!first)return markup;
  const controls=turnInsightButtonsV23(first);
  // The controls belong to the bubble column, not the outer message row;
  // otherwise flexbox places them between the avatar and the message.
  return controls?markup.replace('<div class="bubble-stack">','<div class="bubble-stack">'+controls):markup;
};
function turnInsightMessageV23(id){return messages.find(message=>String(message.id)===String(id))||null}
function traceTextV23(value){return String(value||'—').replace(/\s+/g,' ').trim()||'—'}
function toolCallMarkupV23(call,index){
  const name=String(call?.name||'unknown_tool');
  const label=TURN_TOOL_NAMES_V23[name]||name;
  const failed=call?.ok===false;
  const status=failed?'失败':'成功';
  return '<details class="turn-tool-row-v23"><summary class="turn-tool-row-head-v23"><div><strong>'+esc(label)+'</strong><small>'+esc(name)+'</small></div><span class="'+(failed?'failed':'success')+'">'+status+'</span><i aria-hidden="true"></i></summary><dl><div><dt>参数</dt><dd>'+esc(traceTextV23(call?.args))+'</dd></div><div><dt>结果</dt><dd>'+esc(traceTextV23(call?.result))+'</dd></div></dl></details>';
}
function ensureTurnInsightSheetV23(){
  const existing=$('turnInsightSheetV23');
  if(existing){
    // Keep the sheet at the page root so no message/bubble stacking context can
    // place the composer above it.
    if(existing.parentElement!==document.body)document.body.append(existing);
    return;
  }
  document.body.insertAdjacentHTML('beforeend','<dialog class="turn-insight-sheet-v23" id="turnInsightSheetV23" hidden aria-labelledby="turnInsightTitleV23"><button type="button" class="turn-insight-backdrop-v23" data-turn-insight-close aria-label="关闭"></button><section class="turn-insight-panel-v23"><div class="turn-insight-grab-v23"></div><header><h2 id="turnInsightTitleV23"></h2><button type="button" class="turn-insight-close-v23" data-turn-insight-close aria-label="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="turn-insight-content-v23" id="turnInsightContentV23"></div></section></dialog>');
}
function openTurnInsightV23(kind,id,messageOverride=null){
  const message=messageOverride||turnInsightMessageV23(id);
  if(!message){toast('这条消息的详情暂时无法读取，请重新进入当前聊天后再试','error');return}
  const calls=Array.isArray(message.toolCalls)?message.toolCalls:[];
  const reasoning=String(message.reasoning||'').trim();
  if(kind==='tools'&&!calls.length)return;
  if(kind==='thinking'&&!reasoning)return;
  ensureTurnInsightSheetV23();
  const sheet=$('turnInsightSheetV23'),title=$('turnInsightTitleV23'),content=$('turnInsightContentV23');
  title.textContent=kind==='thinking'?'Thought process':'Tool calls';
  content.innerHTML=kind==='thinking'
    ?'<p class="turn-thinking-copy-v23">'+esc(reasoning)+'</p>'
    :'<p class="turn-tool-intro-v23">This reply used '+calls.length+' tool'+(calls.length===1?'':'s')+'.</p>'+calls.map(toolCallMarkupV23).join('');
  sheet.hidden=false;
  if(typeof sheet.showModal==='function'&&!sheet.open)sheet.showModal();
  document.body.classList.add('turn-insight-open-v23');
  requestAnimationFrame(()=>sheet.classList.add('show'));
}
function closeTurnInsightV23(){
  const sheet=$('turnInsightSheetV23');if(!sheet)return;
  sheet.classList.remove('show');document.body.classList.remove('turn-insight-open-v23');
  setTimeout(()=>{if(!sheet.classList.contains('show')){if(typeof sheet.close==='function'&&sheet.open)sheet.close();sheet.hidden=true}},180);
}
function injectTurnInsightStylesV23(){
  if($('turnInsightStylesV23'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="turnInsightStylesV23">'+
    '.message-group.assistant .turn-insights-v23{display:flex;align-self:flex-start;gap:9px;align-items:center;margin:0 0 3px 1px}.turn-insight-trigger-v23{position:relative;display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:transparent;color:color-mix(in srgb,var(--chat-muted) 82%,transparent);box-shadow:none;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.turn-insight-trigger-v23:active{transform:scale(.9);color:var(--chat-accent)}.turn-insight-trigger-v23 svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}.turn-insight-trigger-v23 em{position:absolute;right:-5px;top:-5px;min-width:13px;height:13px;padding:0 2px;border:1px solid var(--chat-surface);border-radius:99px;background:var(--chat-accent);color:var(--chat-surface);font:700 8px/13px var(--font-b);font-style:normal;text-align:center}',
    '.turn-insight-sheet-v23{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;opacity:0;transition:opacity .18s ease}.turn-insight-sheet-v23[hidden]{display:none}.turn-insight-sheet-v23.show{opacity:1}.turn-insight-backdrop-v23{position:absolute;inset:0;border:0;background:rgba(48,39,33,.24);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);cursor:pointer}.turn-insight-panel-v23{position:relative;z-index:1;box-sizing:border-box;width:100%;min-height:min(56vh,450px);max-height:min(82vh,720px);padding:10px 0 calc(20px + env(safe-area-inset-bottom));overflow:hidden;border-radius:30px 30px 0 0;background:color-mix(in srgb,var(--chat-surface) 96%,#fff);box-shadow:0 -10px 28px rgba(51,38,31,.12);transform:translateY(28px);transition:transform .22s cubic-bezier(.2,.8,.2,1)}.turn-insight-sheet-v23.show .turn-insight-panel-v23{transform:none}.turn-insight-grab-v23{width:38px;height:5px;margin:0 auto 11px;border-radius:99px;background:color-mix(in srgb,var(--chat-muted) 32%,transparent)}.turn-insight-panel-v23 header,.turn-insight-panel-v25 header{display:flex;align-items:center;justify-content:center;min-height:35px;padding:0 24px}.turn-insight-panel-v23 h2,.turn-insight-panel-v25 h2{margin:0;color:var(--chat-text);font:700 26px/1.2 var(--font-b);letter-spacing:-.4px}.turn-insight-close-v23,.turn-insight-close-v25{position:absolute;right:20px;top:21px;display:grid;place-items:center;width:31px;height:31px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--chat-muted);cursor:pointer}.turn-insight-close-v23 svg,.turn-insight-close-v25 svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.turn-insight-content-v23{box-sizing:border-box;min-height:320px;max-height:calc(min(82vh,720px) - 79px);padding:30px 31px 18px;overflow:auto;overscroll-behavior:contain}.turn-thinking-copy-v23{margin:0;color:var(--chat-text);font:500 17px/1.9 var(--font-b);white-space:pre-wrap;word-break:break-word}.turn-tool-intro-v23{margin:0 0 17px;color:var(--chat-muted);font:14px/1.5 var(--font-b)}.turn-tool-row-v23{margin:0 0 12px;padding:15px;border:1px solid color-mix(in srgb,var(--chat-border) 86%,transparent);border-radius:17px;background:color-mix(in srgb,var(--accent-pale) 30%,var(--chat-surface))}.turn-tool-row-head-v23{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.turn-tool-row-head-v23 strong,.turn-tool-row-head-v23 small{display:block}.turn-tool-row-head-v23 strong{font:700 16px/1.3 var(--font-b);color:var(--chat-text)}.turn-tool-row-head-v23 small{margin-top:3px;color:var(--chat-muted);font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace}.turn-tool-row-head-v23 span{flex:none;padding:3px 7px;border-radius:99px;font:12px/1.2 var(--font-b)}.turn-tool-row-head-v23 span.success{background:color-mix(in srgb,#4eaf76 13%,transparent);color:#3f8b60}.turn-tool-row-head-v23 span.failed{background:color-mix(in srgb,#d65c5c 12%,transparent);color:#b74b4b}.turn-tool-row-v23 dl{margin:13px 0 0}.turn-tool-row-v23 dl>div+div{margin-top:9px}.turn-tool-row-v23 dt{margin:0 0 3px;color:var(--chat-muted);font:600 10px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase}.turn-tool-row-v23 dd{margin:0;color:var(--chat-text);font:13px/1.55 var(--font-b);white-space:pre-wrap;word-break:break-word}.turn-insight-open-v23{overflow:hidden}.turn-insight-sheet-v25{position:fixed;inset:0;z-index:1100;display:flex;align-items:flex-end;visibility:hidden;pointer-events:none;opacity:0;transition:opacity .18s ease,visibility .18s}.turn-insight-sheet-v25:target{visibility:visible;pointer-events:auto;opacity:1}.turn-insight-backdrop-v25{position:absolute;inset:0;background:rgba(48,39,33,.24);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}.turn-insight-panel-v25{position:relative;z-index:1;box-sizing:border-box;width:100%;min-height:min(56vh,450px);max-height:min(82vh,720px);padding:10px 0 calc(20px + env(safe-area-inset-bottom));overflow:hidden;border-radius:30px 30px 0 0;background:color-mix(in srgb,var(--chat-surface) 96%,#fff);box-shadow:0 -10px 28px rgba(51,38,31,.12);transform:translateY(28px);transition:transform .22s cubic-bezier(.2,.8,.2,1)}.turn-insight-sheet-v25:target .turn-insight-panel-v25{transform:none}@media(min-width:700px){.turn-insight-panel-v23,.turn-insight-panel-v25{width:min(590px,100%);margin:0 auto;border-radius:30px 30px 0 0}}</style>');
}
function injectStaticInsightStylesV25(){
  if($('turnInsightStaticStylesV25'))return;
  const css=[
    '.turn-insight-sheet-v25{position:fixed!important;inset:0!important;z-index:1100!important;display:flex!important;align-items:flex-end!important;width:auto!important;height:auto!important;margin:0!important;visibility:hidden;pointer-events:none;opacity:0;transition:opacity .18s ease,visibility .18s}',
    '.turn-insight-sheet-v25:target{visibility:visible;pointer-events:auto;opacity:1}',
    '.turn-insight-backdrop-v25{position:absolute;inset:0;display:block;background:rgba(48,39,33,.24);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}',
    '.turn-insight-panel-v25{position:relative;z-index:1;box-sizing:border-box;width:100%;min-height:min(56vh,450px);max-height:min(82vh,720px);padding:10px 0 calc(20px + env(safe-area-inset-bottom));overflow:hidden;border-radius:30px 30px 0 0;background:color-mix(in srgb,var(--chat-surface) 96%,#fff);box-shadow:0 -10px 28px rgba(51,38,31,.12);transform:translateY(28px);transition:transform .22s cubic-bezier(.2,.8,.2,1)}',
    '.turn-insight-sheet-v25:target .turn-insight-panel-v25{transform:none}',
    '.turn-insight-panel-v25 .turn-insight-grab-v23{width:38px;height:5px;margin:0 auto 11px;border-radius:99px;background:color-mix(in srgb,var(--chat-muted) 32%,transparent)}',
    '.turn-insight-panel-v25 header{display:flex;align-items:center;justify-content:center;min-height:35px;padding:0 24px}',
    '.turn-insight-panel-v25 h2{margin:0;color:var(--chat-text);font:700 26px/1.2 var(--font-b);letter-spacing:-.4px}',
    '.turn-insight-close-v25{position:absolute;right:20px;top:21px;display:grid;place-items:center;width:31px;height:31px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--chat-muted);text-decoration:none}',
    '.turn-insight-close-v25 svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}',
    '.turn-insight-panel-v25 .turn-insight-content-v23{box-sizing:border-box;min-height:320px;max-height:calc(min(82vh,720px) - 79px);padding:30px 31px 18px;overflow:auto;overscroll-behavior:contain}',
    '.turn-insight-panel-v25 .turn-thinking-copy-v23{margin:0;color:var(--chat-text);font:500 17px/1.9 var(--font-b);white-space:pre-wrap;word-break:break-word}',
    '.turn-insight-panel-v25 .turn-tool-intro-v23{margin:0 0 17px;color:var(--chat-muted);font:14px/1.5 var(--font-b)}',
    '.turn-insight-panel-v25 .turn-tool-row-v23{margin:0 0 12px;padding:15px;border:1px solid color-mix(in srgb,var(--chat-border) 86%,transparent);border-radius:17px;background:color-mix(in srgb,var(--accent-pale) 30%,var(--chat-surface))}',
    '.turn-insight-panel-v25 .turn-tool-row-head-v23{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}',
    '.turn-insight-panel-v25 .turn-tool-row-head-v23 strong,.turn-insight-panel-v25 .turn-tool-row-head-v23 small{display:block}',
    '.turn-insight-panel-v25 .turn-tool-row-head-v23 strong{font:700 16px/1.3 var(--font-b);color:var(--chat-text)}',
    '.turn-insight-panel-v25 .turn-tool-row-head-v23 small{margin-top:3px;color:var(--chat-muted);font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace}',
    '.turn-insight-panel-v25 .turn-tool-row-head-v23 span{flex:none;padding:3px 7px;border-radius:99px;font:12px/1.2 var(--font-b)}',
    '.turn-insight-panel-v25 .turn-tool-row-head-v23 span.success{background:color-mix(in srgb,#4eaf76 13%,transparent);color:#3f8b60}',
    '.turn-insight-panel-v25 .turn-tool-row-head-v23 span.failed{background:color-mix(in srgb,#d65c5c 12%,transparent);color:#b74b4b}',
    '.turn-insight-panel-v25 .turn-tool-row-v23 dl{margin:13px 0 0}.turn-insight-panel-v25 .turn-tool-row-v23 dl>div+div{margin-top:9px}',
    '.turn-insight-panel-v25 .turn-tool-row-v23 dt{margin:0 0 3px;color:var(--chat-muted);font:600 10px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase}',
    '.turn-insight-panel-v25 .turn-tool-row-v23 dd{margin:0;color:var(--chat-text);font:13px/1.55 var(--font-b);white-space:pre-wrap;word-break:break-word}',
    '@media(min-width:700px){.turn-insight-panel-v25{width:min(590px,100%);margin:0 auto}}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="turnInsightStaticStylesV25">'+css+'</style>');
}
function enhanceTurnInsightsV23(){
  injectTurnInsightStylesV23();injectStaticInsightStylesV25();ensureTurnInsightSheetV23();
  if(document.documentElement.dataset.turnInsightV23)return;
  document.documentElement.dataset.turnInsightV23='true';
  // Capture phase is intentional: message selection/gesture handlers run on
  // the bubble afterwards and must not swallow the detail button on mobile.
  const openTrigger=event=>{const trigger=event.target.closest('[data-turn-insight]');if(!trigger)return false;event.preventDefault();event.stopPropagation();trigger.__turnInsightOpenedAt=Date.now();openTurnInsightV23(trigger.dataset.turnInsight,trigger.dataset.messageId,trigger.__turnInsightMessage);return true};
  document.addEventListener('pointerup',openTrigger,true);
  document.addEventListener('click',event=>{const trigger=event.target.closest('[data-turn-insight]');if(trigger){if(Date.now()-Number(trigger.__turnInsightOpenedAt||0)<700){event.preventDefault();event.stopPropagation();return}openTrigger(event);return}if(event.target.closest('[data-turn-insight-close]'))closeTurnInsightV23()},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeTurnInsightV23()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceTurnInsightsV23);else enhanceTurnInsightsV23();

/* V24: bind each rendered control directly, so chat-level gesture handlers
   cannot swallow the tap on mobile browsers. */
const renderMessagesV24Base=renderMessages;
renderMessages=function(){
  renderMessagesV24Base();
  document.querySelectorAll('[data-turn-insight]').forEach(button=>{
    // Retain the rendered message as a fallback for an in-flight refresh.
    // The global capture listener above is the single click path.
    button.__turnInsightMessage=turnInsightMessageV23(button.dataset.messageId);
    button.onclick=null;
    button.onpointerup=null;
  });
};

/* V26: root-level, scroll-safe insight sheet with compact tool cards. */
function injectTurnInsightStylesV26(){
  if($('turnInsightStylesV26'))return;
  const css=[
    '.turn-insight-sheet-v23{z-index:2000!important}',
    '.turn-insight-panel-v23{display:flex;flex-direction:column;min-height:min(56dvh,450px);max-height:min(86dvh,760px);padding-bottom:max(20px,env(safe-area-inset-bottom))}',
    '.turn-insight-panel-v23 header{flex:none}',
    '.turn-insight-content-v23{flex:1;min-height:0;max-height:none;padding:24px 31px 18px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
    '.turn-insight-panel-v23 .turn-thinking-copy-v23{font-family:"Cormorant Garamond","PingFang SC","Hiragino Sans GB","Microsoft YaHei",serif;font-weight:500;font-size:18px;line-height:1.85}',
    '.turn-insight-panel-v23 .turn-tool-row-v23{margin:0 0 10px;padding:0;overflow:hidden}',
    '.turn-insight-panel-v23 .turn-tool-row-head-v23{display:grid;grid-template-columns:minmax(0,1fr) auto 16px;align-items:center;gap:10px;padding:14px 15px;cursor:pointer;list-style:none}',
    '.turn-insight-panel-v23 .turn-tool-row-head-v23::-webkit-details-marker{display:none}',
    '.turn-insight-panel-v23 .turn-tool-row-head-v23>div{min-width:0}',
    '.turn-insight-panel-v23 .turn-tool-row-head-v23 strong{font-family:var(--font-b);font-size:15px}',
    '.turn-insight-panel-v23 .turn-tool-row-head-v23 small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.turn-insight-panel-v23 .turn-tool-row-head-v23 i{width:8px;height:8px;border-right:1.5px solid var(--chat-muted);border-bottom:1.5px solid var(--chat-muted);transform:rotate(45deg) translateY(-2px);transition:transform .18s ease}',
    '.turn-insight-panel-v23 .turn-tool-row-v23[open] .turn-tool-row-head-v23 i{transform:rotate(225deg) translate(-2px,-1px)}',
    '.turn-insight-panel-v23 .turn-tool-row-v23 dl{margin:0;padding:0 15px 15px;border-top:1px solid color-mix(in srgb,var(--chat-border) 72%,transparent)}',
    '.turn-insight-panel-v23 .turn-tool-row-v23 dl>div:first-child{margin-top:12px}',
    '.turn-insight-panel-v23 .turn-tool-row-v23 dt{font-family:var(--font-b);letter-spacing:.02em;text-transform:none}',
    '.turn-insight-panel-v23 .turn-tool-row-v23 dd{font-family:var(--font-b);font-size:12px;line-height:1.6}',
    '@media(max-width:540px){.turn-insight-panel-v23{max-height:88dvh}.turn-insight-content-v23{padding:20px 20px 16px}.turn-insight-panel-v23 .turn-thinking-copy-v23{font-size:17px}}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend','<style id="turnInsightStylesV26">'+css+'</style>');
}
function enhanceTurnInsightsV26(){
  injectTurnInsightStylesV26();
  ensureTurnInsightSheetV23();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceTurnInsightsV26);else enhanceTurnInsightsV26();

/* V29: keep per-turn insight buttons compact and close to the first bubble. */
function injectTurnInsightSpacingV29(){
  if($('turnInsightSpacingV29'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="turnInsightSpacingV29">.message-group.assistant .turn-insights-v23{gap:2px!important;margin:0 0 -4px 1px!important}.turn-insight-trigger-v23{width:22px!important;height:22px!important}.turn-insight-trigger-v23 svg{width:16px!important;height:16px!important}.turn-insight-trigger-v23 em{right:-3px!important;top:-4px!important}</style>');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectTurnInsightSpacingV29);else injectTurnInsightSpacingV29();

/* V30: companion scene sheet — scene vocabulary and timing rules. */
let companionSleepKindV30='day';
const companionSceneMetaV30={
  study:['学习','<svg viewBox="0 0 24 24"><path d="m4 20 4.7-1.1L19 8.6 15.4 5 5.1 15.3 4 20Z"/><path d="m13.8 6.6 3.6 3.6"/></svg>'],
  vocabulary:['背单词','<svg viewBox="0 0 24 24"><path d="M5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v13.5H6.8A1.8 1.8 0 0 0 5 21V6a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M5 19.5h13.5M8 8h8M8 11.5h8"/></svg>'],
  exercise:['运动','<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'],
  sleep:['睡眠',companionIconV24()],
  bath:['沐浴','<svg viewBox="0 0 24 24"><path d="M12 3s-5.5 6.5-5.5 11A5.5 5.5 0 0 0 12 19.5 5.5 5.5 0 0 0 17.5 14C17.5 9.5 12 3 12 3Z"/></svg>'],
  custom:['OTHER','<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>']
};
function injectCompanionV30Styles(){if($('companionStylesV30'))return;document.head.insertAdjacentHTML('beforeend','<style id="companionStylesV30">.hidden{display:none!important}.companion-scene-v24 span svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.companion-custom-number-v30,.companion-custom-name-v30{width:118px!important;max-width:118px!important;box-sizing:border-box;padding:8px 9px;border:1px solid var(--chat-border);border-radius:10px;background:var(--chat-bg);color:var(--chat-text);font:13px var(--font-b)}.companion-custom-name-v30{width:178px!important;max-width:178px!important}.companion-field-v24 em{margin-left:auto;color:var(--chat-muted);font-style:normal}.companion-field-v24 .companion-choice-v24{margin-left:auto}.companion-setup-note-v30{margin:2px 0 0;color:var(--chat-muted);font:11px/1.5 var(--font-b)}</style>')}
function companionPickerMarkupV30(){return '<section class="companion-picker-v24" id="companionPickerV24" aria-hidden="true"><div class="companion-picker-card-v24" role="dialog" aria-modal="true"><div class="companion-picker-grab-v24"></div><header class="companion-picker-head-v24"><h2>SCENES</h2><button type="button" class="companion-picker-close-v24" aria-label="关闭">×</button></header><div class="companion-scene-grid-v24" id="companionSceneGridV24"></div><section class="companion-setup-v24"><h3 class="companion-setup-title-v24">SETTINGS</h3><label class="companion-field-v24 hidden" id="companionCustomNameRowV30"><span>名称</span><input id="companionCustomNameV30" class="companion-custom-name-v30" maxlength="40" placeholder="例如：阅读"></label><div class="companion-field-v24 hidden" id="companionSleepKindV30"><span>模式</span><div class="companion-choice-v24"><button type="button" data-sleep-kind="day" class="on">白天</button><button type="button" data-sleep-kind="night">夜晚</button></div></div><label class="companion-field-v24" id="companionDurationV24"><span>时长</span><select id="companionDurationSelectV24"><option value="25">25 分钟</option><option value="50">50 分钟</option><option value="90">90 分钟</option><option value="custom">自定义…</option></select><input class="companion-custom-number-v30 hidden" id="companionDurationCustomV30" type="number" min="1" max="720" placeholder="分钟"></label><label class="companion-field-v24"><span>白噪音</span><select id="companionAmbientV24"><option value="rain">雨声</option><option value="waves">海浪</option><option value="fire">壁炉</option><option value="cafe">咖啡馆</option><option value="wind">风声</option><option value="none">关闭</option></select></label><label class="companion-field-v24"><span>AI 主动关心</span><input type="checkbox" class="switch" id="companionAutoV24" checked></label><label class="companion-field-v24" id="companionIntervalV24"><span>间隔</span><select id="companionIntervalSelectV24"><option value="5">5 分钟</option><option value="10">10 分钟</option><option value="15">15 分钟</option><option value="custom">自定义…</option></select><input class="companion-custom-number-v30 hidden" id="companionIntervalCustomV30" type="number" min="1" max="720" placeholder="分钟"></label><label class="companion-field-v24 hidden" id="companionAutoWindowV30"><span>主动关心范围</span><select id="companionAutoWindowSelectV30"><option value="30">30 分钟</option><option value="60">60 分钟</option><option value="90">90 分钟</option><option value="custom">自定义…</option></select><input class="companion-custom-number-v30 hidden" id="companionAutoWindowCustomV30" type="number" min="1" max="720" placeholder="分钟"></label><p class="companion-setup-note-v30" id="companionSetupNoteV30"></p><button type="button" class="companion-start-v24" id="companionStartV24">进入</button></section></div></section>'}
function companionNumberV30(selectId,inputId){const value=$(selectId).value;return value==='custom'?Number($(inputId).value||0):Number(value)}
function renderCompanionScenesV30(){const grid=$('companionSceneGridV24');if(!grid)return;grid.innerHTML=COMPANION_SCENES_V24.map(([id])=>{const meta=companionSceneMetaV30[id];return '<button type="button" class="companion-scene-v24 '+(id===companionSceneV24?'selected':'')+'" data-scene="'+id+'"><span>'+meta[1]+'</span><b>'+meta[0]+'</b></button>'}).join('');grid.querySelectorAll('[data-scene]').forEach(button=>button.onclick=()=>{companionSceneV24=button.dataset.scene;if(companionSceneV24==='sleep'){companionSleepKindV30='day';$('companionAutoV24').checked=false}else $('companionAutoV24').checked=true;renderCompanionScenesV30();syncCompanionSetupV30()})}
function syncCustomFieldV30(selectId,inputId){$(inputId).classList.toggle('hidden',$(selectId).value!=='custom')}
function syncCompanionSetupV30(){const sleep=companionSceneV24==='sleep',night=sleep&&companionSleepKindV30==='night',auto=$('companionAutoV24').checked;const durationRow=$('companionDurationV24'),intervalRow=$('companionIntervalV24');$('companionCustomNameRowV30').classList.toggle('hidden',companionSceneV24!=='custom');$('companionSleepKindV30').classList.toggle('hidden',!sleep);durationRow.classList.toggle('hidden',night);intervalRow.classList.toggle('hidden',!auto);$('companionAutoWindowV30').classList.toggle('hidden',!(sleep&&auto));$('companionAutoV24').checked=sleep?auto:$('companionAutoV24').checked;document.querySelectorAll('[data-sleep-kind]').forEach(button=>button.classList.toggle('on',button.dataset.sleepKind===companionSleepKindV30));syncCustomFieldV30('companionDurationSelectV24','companionDurationCustomV30');syncCustomFieldV30('companionIntervalSelectV24','companionIntervalCustomV30');syncCustomFieldV30('companionAutoWindowSelectV30','companionAutoWindowCustomV30');const note=$('companionSetupNoteV30');note.textContent=night?'进入房间并点击开始后才会计时；超过主动关心范围后，TA 不再自动发送消息。':auto?'AI 回复间隔不能超过本次时长。':'TA 只会在你主动要求时回复。'}
function ensureCompanionPickerV30(){const old=$('companionPickerV24');if(old)old.remove();document.body.insertAdjacentHTML('beforeend',companionPickerMarkupV30());const picker=$('companionPickerV24');picker.querySelector('.companion-picker-close-v24').onclick=closeCompanionPickerV24;picker.onclick=event=>{if(event.target===picker)closeCompanionPickerV24()};['companionAutoV24','companionDurationSelectV24','companionIntervalSelectV24','companionAutoWindowSelectV30'].forEach(id=>$(id).onchange=syncCompanionSetupV30);picker.querySelectorAll('[data-sleep-kind]').forEach(button=>button.onclick=()=>{companionSleepKindV30=button.dataset.sleepKind;syncCompanionSetupV30()});$('companionStartV24').onclick=startCompanionV30;renderCompanionScenesV30();syncCompanionSetupV30()}
function openCompanionPickerV30(){if(!current)return toast('请先进入一个聊天房间');ensureCompanionPickerV30();$('companionPickerV24').classList.add('open');$('companionPickerV24').setAttribute('aria-hidden','false')}
async function startCompanionV30(){if(!current)return;const button=$('companionStartV24'),sleep=companionSceneV24==='sleep',night=sleep&&companionSleepKindV30==='night',auto=$('companionAutoV24').checked;const duration=night?0:companionNumberV30('companionDurationSelectV24','companionDurationCustomV30'),interval=auto?companionNumberV30('companionIntervalSelectV24','companionIntervalCustomV30'):5,autoWindow=sleep&&auto?companionNumberV30('companionAutoWindowSelectV30','companionAutoWindowCustomV30'):0;if(!night&&(!duration||duration<1))return toast('请输入有效时长','error');if(auto&&(!interval||interval<1))return toast('请输入有效的主动关心间隔','error');if(auto&&!night&&interval>duration)return toast('AI 回复间隔不能超过本次时长','error');if(sleep&&auto&&(!autoWindow||autoWindow<1))return toast('请输入主动关心的时间范围','error');button.disabled=true;try{const customName=String($('companionCustomNameV30').value||'').trim();const session=await api('/api/companion/sessions',{method:'POST',body:JSON.stringify({scene:companionSceneV24,name:companionSceneV24==='custom'?(customName||'Other'):(companionSceneMetaV30[companionSceneV24][0]),timerMode:night?'elapsed':'countdown',durationSeconds:duration*60,ambient:$('companionAmbientV24').value,autoEnabled:auto,autoIntervalMinutes:interval,autoUntilMinutes:autoWindow,sleepMode:night?'night':'nap',roleId:current.roleId||'',conversationId:current.id})});location.href='companion.html?session='+encodeURIComponent(session.id)+'&chat='+encodeURIComponent(current.id)}catch(error){toast('创建陪伴房间失败：'+error.message,'error')}finally{button.disabled=false}}
ensureCompanionPickerV24=ensureCompanionPickerV30;openCompanionPickerV24=openCompanionPickerV30;renderCompanionScenesV24=renderCompanionScenesV30;syncCompanionSetupV24=syncCompanionSetupV30;function enhanceCompanionV30(){injectCompanionV30Styles();ensureCompanionPickerV30();ensureCompanionEntryV24();$('openCompanionV24').onclick=openCompanionPickerV30}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceCompanionV30);else enhanceCompanionV30();

/* V31: a finished companion room returns as a readable, model-visible record. */
function companionDurationLabelV31(seconds){seconds=Math.max(0,Math.round(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return (h?h+' 小时 ':'')+(m?m+' 分钟 ':'')+(s||(!h&&!m)?s+' 秒':'')}
function companionCompletionMarkupV31(message){const item=message.companionCompletion||{},name=esc(item.name||'陪伴'),scene=esc({study:'学习',vocabulary:'背单词',exercise:'运动',sleep:'睡眠',bath:'沐浴',custom:'自定义'}[item.scene]||'陪伴'),duration=esc(companionDurationLabelV31(item.actualSeconds));return '<article class="companion-completion-v31" data-companion-record="'+esc(String(message.id||''))+'"><span class="companion-completion-kicker-v31">COMPANION · 完成</span><strong>'+name+'</strong><p>'+scene+' · 一起度过 '+duration+'</p><button type="button" data-companion-record="'+esc(String(message.id||''))+'">查看陪伴记录</button></article>'}
const renderGroupV31Base=renderGroup;
renderGroup=function(group,role){const first=group?.messages?.[0];if(first?.systemType==='companion_completion'||first?.companionCompletion)return '<div class="companion-completion-row-v31">'+companionCompletionMarkupV31(first)+'</div>';return renderGroupV31Base(group,role)};
function ensureCompanionRecordSheetV31(){if($('companionRecordSheetV31'))return;document.body.insertAdjacentHTML('beforeend','<dialog class="companion-record-sheet-v31" id="companionRecordSheetV31"><button type="button" class="companion-record-backdrop-v31" data-close-companion-record aria-label="关闭"></button><section><header><h2>陪伴记录</h2><button type="button" data-close-companion-record aria-label="关闭">×</button></header><pre id="companionRecordTextV31"></pre></section></dialog>');document.addEventListener('click',event=>{if(event.target.closest('[data-close-companion-record]')){$('companionRecordSheetV31')?.close();return}const button=event.target.closest('[data-companion-record]');if(!button)return;const message=messages.find(item=>String(item.id)===String(button.dataset.companionRecord));if(!message)return;$('companionRecordTextV31').textContent=String(message.content||'');$('companionRecordSheetV31').showModal()})}
function injectCompanionCompletionStylesV31(){if($('companionCompletionStylesV31'))return;document.head.insertAdjacentHTML('beforeend','<style id="companionCompletionStylesV31">.companion-completion-row-v31{display:flex;justify-content:center;margin:12px 0}.companion-completion-v31{width:min(360px,90%);padding:15px 16px;border:1px solid var(--chat-border);border-radius:18px;background:color-mix(in srgb,var(--chat-surface) 92%,transparent);box-shadow:var(--shadow-xs);text-align:left}.companion-completion-v31 .companion-completion-kicker-v31{display:block;margin-bottom:7px;color:var(--chat-muted);font:11px var(--font-b);letter-spacing:.09em}.companion-completion-v31 strong{display:block;color:var(--chat-text);font:400 18px var(--font-d)}.companion-completion-v31 p{margin:7px 0 12px;color:var(--chat-muted);font:13px/1.5 var(--font-b)}.companion-completion-v31 button{padding:0;border:0;background:none;color:var(--chat-accent);font:13px var(--font-b);cursor:pointer}.companion-record-sheet-v31{width:100%;height:100%;max-width:none;max-height:none;padding:0;border:0;background:transparent}.companion-record-sheet-v31::backdrop{background:rgba(42,35,39,.34);backdrop-filter:blur(5px)}.companion-record-sheet-v31>.companion-record-backdrop-v31{position:fixed;inset:0;border:0;background:transparent}.companion-record-sheet-v31 section{position:fixed;left:50%;bottom:0;box-sizing:border-box;width:min(620px,100%);max-height:82dvh;transform:translateX(-50%);padding:18px 20px calc(22px + env(safe-area-inset-bottom));overflow:auto;border-radius:24px 24px 0 0;background:var(--chat-surface);box-shadow:var(--shadow-md)}.companion-record-sheet-v31 header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--chat-border)}.companion-record-sheet-v31 h2{margin:0;font:400 23px var(--font-d)}.companion-record-sheet-v31 header button{border:0;background:transparent;color:var(--chat-muted);font-size:25px;cursor:pointer}.companion-record-sheet-v31 pre{margin:15px 0 0;color:var(--chat-text);font:13px/1.7 var(--font-b);white-space:pre-wrap;word-break:break-word}</style>')}
const initV31Base=init;
init=async function(){await initV31Base();ensureCompanionRecordSheetV31();const requested=new URLSearchParams(location.search).get('conversation');if(requested&&conversations.some(item=>item.id===requested&&!item.archived)){await openConversation(requested);history.replaceState(null,'',location.pathname)}};
async function restoreCompanionReturnV31(){const requested=new URLSearchParams(location.search).get('conversation');if(!requested)return;for(let attempt=0;attempt<40;attempt++){if(conversations.some(item=>item.id===requested&&!item.archived)){await openConversation(requested);history.replaceState(null,'',location.pathname);return}await new Promise(resolve=>setTimeout(resolve,100))}}
restoreCompanionReturnV31();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectCompanionCompletionStylesV31();ensureCompanionRecordSheetV31()});else{injectCompanionCompletionStylesV31();ensureCompanionRecordSheetV31()}

/* V32: the plus menu can send a real companion invitation card. */
const COMPANION_SCENE_LABELS_V32={study:'学习',vocabulary:'背单词',exercise:'运动',sleep:'睡眠',bath:'沐浴',custom:'自定义'};
function companionInvitationMarkupV32(message){const item=message.companionInvitation||{},scene=esc(COMPANION_SCENE_LABELS_V32[item.scene]||'陪伴'),from=item.from==='iris'?'我':'TA',status=item.status||'pending';const intro=status==='accepted'?'TA 接受了这次邀请':status==='declined'?'TA 这次先婉拒了':from==='TA'?`TA 想邀请你一起${scene}`:`我邀请 TA 一起${scene}`;const action=status==='accepted'?'<button type="button" data-companion-invitation-enter="'+esc(String(message.id||''))+'">一起进入</button>':status==='pending'&&item.from==='ta'?'<button type="button" data-companion-invitation-setup="'+esc(String(message.id||''))+'">设置并进入</button>':status==='pending'?'<span>等待 TA 回复…</span>':'';return '<article class="companion-invitation-v32"><span>COMPANION · 邀请</span><strong>'+intro+'</strong><p>'+scene+'</p>'+action+'</article>'}
const renderGroupV32Base=renderGroup;
renderGroup=function(group,role){const first=group?.messages?.[0];if(first?.systemType==='companion_invitation'||first?.companionInvitation)return '<div class="companion-invitation-row-v32">'+companionInvitationMarkupV32(first)+'</div>';return renderGroupV32Base(group,role)};
function injectCompanionInviteStylesV32(){if($('companionInviteStylesV32'))return;document.head.insertAdjacentHTML('beforeend','<style id="companionInviteStylesV32">.companion-invitation-row-v32{display:flex;justify-content:center;margin:12px 0}.companion-invitation-v32{width:min(330px,88%);padding:15px 16px;border:1px solid var(--chat-border);border-radius:18px;background:color-mix(in srgb,var(--accent-pale) 54%,var(--chat-surface));box-shadow:var(--shadow-xs)}.companion-invitation-v32>span{display:block;margin-bottom:7px;color:var(--chat-muted);font:11px var(--font-b);letter-spacing:.09em}.companion-invitation-v32 strong{display:block;color:var(--chat-text);font:400 17px var(--font-d)}.companion-invitation-v32 p{margin:7px 0 12px;color:var(--chat-muted);font:13px var(--font-b)}.companion-invitation-v32 button{padding:8px 12px;border:0;border-radius:10px;background:var(--chat-accent);color:var(--accent-contrast);font:13px var(--font-b);cursor:pointer}.companion-invitation-v32>span:last-child{font:12px var(--font-b);letter-spacing:0;color:var(--chat-muted)}.companion-add-menu-v32{position:fixed;z-index:1300;display:none;min-width:158px;padding:7px;border:1px solid var(--chat-border);border-radius:14px;background:var(--chat-surface);box-shadow:var(--shadow-md)}.companion-add-menu-v32.open{display:grid;gap:2px}.companion-add-menu-v32 button{display:flex;align-items:center;gap:8px;padding:10px;border:0;border-radius:9px;background:transparent;color:var(--chat-text);font:13px var(--font-b);text-align:left;cursor:pointer}.companion-add-menu-v32 button:active{background:var(--accent-pale)}</style>')}
function ensureCompanionAddMenuV32(){if($('companionAddMenuV32'))return;document.body.insertAdjacentHTML('beforeend','<div class="companion-add-menu-v32" id="companionAddMenuV32"><button type="button" data-add-image>▧ 上传图片</button><button type="button" data-add-companion>☾ 邀请 TA 陪伴</button></div>');const menu=$('companionAddMenuV32');menu.querySelector('[data-add-image]').onclick=()=>{$('imageInput').click();menu.classList.remove('open')};menu.querySelector('[data-add-companion]').onclick=()=>{menu.classList.remove('open');openCompanionInviteV32()};document.addEventListener('click',event=>{if(!event.target.closest('#addImage')&&!event.target.closest('#companionAddMenuV32'))menu.classList.remove('open')})}
function openCompanionAddMenuV32(){ensureCompanionAddMenuV32();const menu=$('companionAddMenuV32'),button=$('addImage'),rect=button.getBoundingClientRect();menu.style.left=Math.max(10,rect.left)+'px';menu.style.bottom=Math.max(68,innerHeight-rect.top+7)+'px';menu.classList.toggle('open')}
function companionConfigV32(){const sleep=companionSceneV24==='sleep',night=sleep&&companionSleepKindV30==='night',auto=$('companionAutoV24').checked;const duration=night?0:companionNumberV30('companionDurationSelectV24','companionDurationCustomV30'),interval=auto?companionNumberV30('companionIntervalSelectV24','companionIntervalCustomV30'):5,autoWindow=sleep&&auto?companionNumberV30('companionAutoWindowSelectV30','companionAutoWindowCustomV30'):0;if(!night&&(!duration||duration<1))throw Error('请输入有效时长');if(auto&&(!interval||interval<1))throw Error('请输入有效的主动关心间隔');if(auto&&!night&&interval>duration)throw Error('AI 回复间隔不能超过本次时长');if(sleep&&auto&&(!autoWindow||autoWindow<1))throw Error('请输入主动关心的时间范围');const customName=String($('companionCustomNameV30').value||'').trim();return {scene:companionSceneV24,name:companionSceneV24==='custom'?(customName||'Other'):companionSceneMetaV30[companionSceneV24][0],timerMode:night?'elapsed':'countdown',durationSeconds:duration*60,ambient:$('companionAmbientV24').value,autoEnabled:auto,autoIntervalMinutes:interval,autoUntilMinutes:autoWindow,sleepMode:night?'night':'nap'}}
async function sendCompanionInviteV32(){if(!current)return;const button=$('companionStartV24');try{const config=companionConfigV32();button.disabled=true;const saved=await api('/api/chat/companion-invitations',{method:'POST',body:JSON.stringify({conversationId:current.id,scene:config.scene,config})});messages.push(saved);pendingTurnGroupId=saved.replyGroupId;closeCompanionPickerV24();renderMessages();scrollBottom();await requestAiReply()}catch(error){toast(error.message||'邀请发送失败','error')}finally{button.disabled=false}}
function openCompanionInviteV32(){if(!current)return toast('请先进入一个聊天房间');ensureCompanionPickerV30();$('companionStartV24').textContent='发送邀请卡';$('companionStartV24').onclick=sendCompanionInviteV32;$('companionPickerV24').classList.add('open');$('companionPickerV24').setAttribute('aria-hidden','false');renderCompanionScenesV30();syncCompanionSetupV30()}
async function enterCompanionInvitationV32(message){const item=message?.companionInvitation||{};if(message?.id&&item.status==='accepted'){try{const data=await api('/api/chat/companion-invitations/'+encodeURIComponent(message.id)+'/enter',{method:'POST',body:JSON.stringify({conversationId:current?.id||''})});const session=data.session;if(!session?.id)throw Error('没有找到陪伴房间');item.sessionId=session.id;companionInvitationSessionsV83?.set(session.id,session);location.href='companion.html?session='+encodeURIComponent(session.id)+'&chat='+encodeURIComponent(current?.id||session.conversationId||'');return}catch(error){toast('进入陪伴房间失败：'+error.message,'error');return}}if(item.config){const config=item.config;api('/api/companion/sessions',{method:'POST',body:JSON.stringify({...config,scene:item.scene||config.scene,roleId:current?.roleId||'',conversationId:current?.id||''})}).then(session=>location.href='companion.html?session='+encodeURIComponent(session.id)+'&chat='+encodeURIComponent(current.id)).catch(error=>toast('创建陪伴房间失败：'+error.message,'error'));return}companionSceneV24=item.scene||'study';ensureCompanionPickerV30();$('companionStartV24').textContent='进入';$('companionStartV24').onclick=startCompanionV30;openCompanionPickerV30()}
function bindCompanionInvitationActionsV32(){document.addEventListener('click',event=>{const button=event.target.closest('[data-companion-invitation-enter],[data-companion-invitation-setup]');if(!button)return;const message=messages.find(item=>String(item.id)===String(button.dataset.companionInvitationEnter||button.dataset.companionInvitationSetup));if(message)enterCompanionInvitationV32(message)})}
function attachCompanionAddButtonV32(){const add=$('addImage');if(add){add.innerHTML=ICON.plus;add.setAttribute('aria-label','更多操作');add.onclick=openCompanionAddMenuV32}}
function enhanceCompanionInviteV32(){injectCompanionInviteStylesV32();ensureCompanionAddMenuV32();bindCompanionInvitationActionsV32();attachCompanionAddButtonV32();let attempts=0;const retry=setInterval(()=>{attachCompanionAddButtonV32();if(++attempts>80)clearInterval(retry)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceCompanionInviteV32);else enhanceCompanionInviteV32();

/* V33: recover from literal tags and restore the last page after a PWA reload. */
const rawInvitationCardsV33=new Map();
function rawInvitationFromGroupV33(group){const combined=(group?.messages||[]).map(item=>String(item.content||'')).join('\n');const match=combined.match(/<companion-(invitation|accept|decline)\s+scene=["'](study|vocabulary|exercise|sleep|bath|custom)["']\s*>([\s\S]*?)<\/companion-\1>/i);if(!match)return null;return {clean:`${combined.slice(0,match.index)}${combined.slice(match.index+match[0].length)}`.replace(/\n{3,}/g,'\n\n').trim(),item:{id:'raw-'+String(group.messages?.[0]?.id||''),from:'ta',scene:match[2].toLowerCase(),status:match[1].toLowerCase()==='accept'?'accepted':match[1].toLowerCase()==='decline'?'declined':'pending',message:String(match[3]||'').trim()}}}
const renderGroupV33Base=renderGroup;
renderGroup=function(group,role){const raw=group?.role==='claude'&&!(group.messages?.[0]?.companionInvitation)&&rawInvitationFromGroupV33(group);if(!raw)return renderGroupV33Base(group,role);const id=String(group.messages?.[0]?.id||'');rawInvitationCardsV33.set(id,raw.item);const clean=raw.clean?renderGroupV33Base({...group,messages:[{...group.messages[0],content:raw.clean}]},role):'';return clean+'<div class="companion-invitation-row-v32">'+companionInvitationMarkupV32({id,companionInvitation:raw.item})+'</div>'};
function restoreLastRouteV33(){const requested=new URLSearchParams(location.search).get('conversation');if(requested)return;let route;try{route=JSON.parse(localStorage.getItem('iris-last-route-v33')||'null')}catch{}if(!route)return;let attempts=0;const resume=async()=>{if(++attempts>80)return;if(!conversations.length){setTimeout(resume,150);return}if(route.kind==='companion'&&route.session){location.replace('companion.html?session='+encodeURIComponent(route.session)+'&chat='+encodeURIComponent(route.chat||''));return}if(route.kind==='chat'&&route.conversation&&conversations.some(item=>item.id===route.conversation&&!item.archived)){await openConversation(route.conversation);return}const lastId=localStorage.getItem(LAST_OPEN_ROOM_KEY_V22);if(lastId&&conversations.some(item=>item.id===lastId&&!item.archived))await openConversation(lastId)};resume()}
const openConversationV33Base=openConversation;
openConversation=async function(id){await openConversationV33Base(id);if(current?.id)localStorage.setItem('iris-last-route-v33',JSON.stringify({kind:'chat',conversation:current.id,at:Date.now()}))};
document.addEventListener('click',event=>{const button=event.target.closest('[data-companion-invitation-enter],[data-companion-invitation-setup]');if(!button)return;const id=String(button.dataset.companionInvitationEnter||button.dataset.companionInvitationSetup||'');const raw=rawInvitationCardsV33.get(id);if(!raw)return;event.preventDefault();event.stopImmediatePropagation();enterCompanionInvitationV32({companionInvitation:raw})},true);
restoreLastRouteV33();

/* V34: companion invitations are an explicit, local state flow. */
function companionRoleNameV34(){return String(roles.find(role=>role.id===current?.roleId)?.name||'TA').trim()||'TA'}
companionInvitationMarkupV32=function(message){const item=message.companionInvitation||{},scene=esc(COMPANION_SCENE_LABELS_V32[item.scene]||'陪伴'),name=esc(companionRoleNameV34()),outgoing=item.from==='iris',status=item.status||'pending',headline=outgoing?`我邀请 ${name} 一起${scene}`:`${name} 想邀请你一起${scene}`;let action='';if(status==='pending'&&outgoing)action='<span class="companion-invitation-status-v34">等待回复</span>';else if(status==='pending')action='<div class="companion-invitation-actions-v34"><button type="button" data-companion-invitation-accept="'+esc(String(message.id||''))+'">同意</button><button type="button" class="quiet" data-companion-invitation-decline="'+esc(String(message.id||''))+'">拒绝</button></div>';else if(status==='accepted')action='<span class="companion-invitation-status-v34">已同意</span>';else action='<span class="companion-invitation-status-v34">已拒绝</span>';return '<article class="companion-invitation-v32 companion-invitation-v34"><span>COMPANION · 邀请</span><strong>'+headline+'</strong>'+action+'</article>'};
function injectCompanionInviteV34Styles(){if($('companionInviteStylesV34'))return;document.head.insertAdjacentHTML('beforeend','<style id="companionInviteStylesV34">.companion-invitation-v34{text-align:center;padding:18px 18px 17px}.companion-invitation-v34>span:first-child{margin-bottom:10px}.companion-invitation-v34 strong{font-size:19px}.companion-invitation-status-v34{display:block;margin-top:16px;color:var(--chat-muted);font:13px var(--font-b);letter-spacing:0}.companion-invitation-actions-v34{display:flex;justify-content:center;gap:9px;margin-top:17px}.companion-invitation-actions-v34 button{min-width:82px}.companion-invitation-actions-v34 button.quiet{border:1px solid var(--chat-border);background:transparent;color:var(--chat-text)}.companion-add-menu-v34{position:fixed;z-index:1400;inset:0;display:block;visibility:hidden;pointer-events:none;background:rgba(32,27,30,.28);opacity:0;transition:opacity .2s ease}.companion-add-menu-v34.open{visibility:visible;pointer-events:auto;opacity:1}.companion-add-menu-v34 .companion-add-sheet-v34{position:absolute;right:0;bottom:0;left:0;box-sizing:border-box;padding:10px 22px calc(26px + env(safe-area-inset-bottom));border-radius:27px 27px 0 0;background:var(--chat-surface);box-shadow:0 -12px 42px rgba(42,35,39,.16);transform:translateY(105%);transition:transform .26s cubic-bezier(.2,.8,.2,1)}.companion-add-menu-v34.open .companion-add-sheet-v34{transform:translateY(0)}.companion-add-grab-v34{width:42px;height:5px;margin:1px auto 22px;border-radius:99px;background:var(--chat-border)}.companion-add-grid-v34{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.companion-add-grid-v34 button{display:grid;justify-items:center;gap:10px;padding:7px 4px 4px;border:0;background:transparent;color:var(--chat-text);font:14px var(--font-b);cursor:pointer}.companion-add-grid-v34 i{display:grid;place-items:center;width:54px;height:54px;border-radius:17px;background:var(--accent-pale);color:var(--chat-accent)}.companion-add-grid-v34 svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.companion-add-backdrop-v34{position:absolute;inset:0;border:0;background:transparent}</style>')}
function ensureCompanionAddMenuV34(){let menu=$('companionAddMenuV32');if(menu&&menu.classList.contains('companion-add-menu-v34'))return menu;if(menu)menu.remove();document.body.insertAdjacentHTML('beforeend','<div class="companion-add-menu-v34" id="companionAddMenuV32" aria-hidden="true"><button type="button" class="companion-add-backdrop-v34" data-add-close aria-label="关闭"></button><section class="companion-add-sheet-v34" role="dialog" aria-label="更多操作"><div class="companion-add-grab-v34"></div><div class="companion-add-grid-v34"><button type="button" data-add-image><i>'+ICON.image+'</i><span>图片</span></button><button type="button" data-add-companion><i>'+companionIconV24()+'</i><span>陪伴</span></button></div></section></div>');menu=$('companionAddMenuV32');const close=()=>{menu.classList.remove('open');menu.setAttribute('aria-hidden','true')};menu.querySelector('[data-add-close]').onclick=close;menu.querySelector('[data-add-image]').onclick=()=>{close();$('imageInput').click()};menu.querySelector('[data-add-companion]').onclick=()=>{close();openCompanionInviteV32()};return menu}
openCompanionAddMenuV32=function(){const menu=ensureCompanionAddMenuV34();const opening=!menu.classList.contains('open');menu.classList.toggle('open',opening);menu.setAttribute('aria-hidden',opening?'false':'true')};
function attachCompanionAddButtonV34(){const add=$('addImage');if(add){add.innerHTML=ICON.plus;add.setAttribute('aria-label','更多操作');add.onclick=openCompanionAddMenuV32}}
const systemMessageLabelV34Base=systemMessageLabelV30;
systemMessageLabelV30=function(message){if(message?.systemType==='companion_invitation_response')return String(message.content||'陪伴邀请已更新');return systemMessageLabelV34Base(message)};
async function respondToCompanionInvitationV34(messageId,action){const message=messages.find(item=>String(item.id)===String(messageId));if(!message)return;const raw=rawInvitationCardsV33.get(String(messageId));if(raw){if(action==='accept')enterCompanionInvitationV32({companionInvitation:raw});return toast('旧邀请卡无法保存回应，已为你打开设置');}try{const data=await api('/api/chat/companion-invitations/'+encodeURIComponent(messageId)+'/respond',{method:'POST',body:JSON.stringify({conversationId:current?.id||'',action})});messages=messages.map(item=>String(item.id)===String(data.invitation?.id)?data.invitation:item);if(data.systemMessage)messages.push(data.systemMessage);renderMessages();scrollBottom();if(action==='accept')enterCompanionInvitationV32(data.invitation);else toast('已拒绝这次邀请')}catch(error){toast(error.message||'邀请处理失败','error')}}
document.addEventListener('click',event=>{const button=event.target.closest('[data-companion-invitation-accept],[data-companion-invitation-decline]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();respondToCompanionInvitationV34(button.dataset.companionInvitationAccept||button.dataset.companionInvitationDecline,button.dataset.companionInvitationAccept?'accept':'decline')},true);
const requestAiReplyV34Base=requestAiReply;
requestAiReply=async function(){if(sending||!current)return;if(savingBubble){toast('消息正在发送，稍候再让 TA 回复');return}const groupId=pendingTurnGroupId||getPendingTurnGroupId(messages),userTurn=messages.filter(message=>message.role==='iris'&&message.replyGroupId===groupId);if(!groupId||!userTurn.length)return toast('先发一条消息吧');sending=true;replyLoadingV20={conversationId:current.id};updateReplyButton();renderMessages();scrollBottom();try{const data=await api('/api/chat/send',{method:'POST',body:JSON.stringify({conversationId:current.id,replyGroupId:groupId,settings})}),base=messages.slice();for(const message of data.userMessages||[]){const index=base.findIndex(item=>item.id===message.id);if(index>=0)base[index]=message;else base.push(message)}await revealAiMessagesV20(data.aiMessages||[],base);for(const message of data.systemMessages||[])if(!messages.some(item=>item.id===message.id))messages.push(message);pendingTurnGroupId='';await refreshConversationMeta();if(data.companionInvitationResult?.status==='accepted'){renderMessages();toast('TA 接受了邀请，正在进入陪伴房间','success');const source=messages.find(item=>String(item.id)===String(data.companionInvitationResult.sourceMessageId));setTimeout(()=>enterCompanionInvitationV32(source||{companionInvitation:{scene:data.companionInvitationResult.scene,config:data.companionInvitationResult.config}}),280)}else if(data.companionInvitationResult?.status==='declined'){renderMessages();toast('对方拒绝了这次邀请')}}catch(error){const delayed=/504|timeout|network|failed to fetch/i.test(error.message||'');replyLoadingV20=null;const systemMessages=Array.isArray(error.data?.systemMessages)?error.data.systemMessages:[];if(systemMessages.length){messages=mergeMessagesV20(messages,systemMessages);renderMessages();toast('回复未完成，失败原因与已保存的工具记录已写入聊天','error')}else{if(delayed)toast('连接较慢，回复若完成会自动出现');else toast('发送失败：'+error.message,'error');try{await syncOpenRoomV20()}catch{}}pendingTurnGroupId=getPendingTurnGroupId(messages)}finally{replyLoadingV20=null;sending=false;updateReplyButton();renderMessages();scrollBottom()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectCompanionInviteV34Styles();ensureCompanionAddMenuV34();attachCompanionAddButtonV34()});else{injectCompanionInviteV34Styles();ensureCompanionAddMenuV34();attachCompanionAddButtonV34()}

/* V35: scene identity, custom names, completion-card polish and a guaranteed
   incoming card when TA was explicitly asked to send one. */
function companionSceneIconV35(scene){return companionSceneMetaV30[scene]?.[1]||companionIconV24()}
function companionActivityNameV35(item){const custom=String(item?.config?.name||'').trim();return item?.scene==='custom'&&custom&&custom.toLowerCase()!=='other'?custom:(COMPANION_SCENE_LABELS_V32[item?.scene]||'陪伴')}
companionInvitationMarkupV32=function(message){const item=message.companionInvitation||{},activity=esc(companionActivityNameV35(item)),name=esc(companionRoleNameV34()),outgoing=item.from==='iris',status=item.status||'pending',headline=outgoing?`我邀请 ${name} 一起${activity}`:`${name} 想邀请你一起${activity}`;let action='';if(status==='pending'&&outgoing)action='<span class="companion-invitation-status-v34">等待回复</span>';else if(status==='pending')action='<div class="companion-invitation-actions-v34"><button type="button" data-companion-invitation-accept="'+esc(String(message.id||''))+'">同意</button><button type="button" class="quiet" data-companion-invitation-decline="'+esc(String(message.id||''))+'">拒绝</button></div>';else if(status==='accepted')action='<span class="companion-invitation-status-v34">已同意</span>';else action='<span class="companion-invitation-status-v34">已拒绝</span>';return '<article class="companion-invitation-v32 companion-invitation-v34 companion-card-v35"><i class="companion-scene-icon-v35">'+companionSceneIconV35(item.scene)+'</i><span>COMPANION · 邀请</span><strong>'+headline+'</strong>'+action+'</article>'};
companionCompletionMarkupV31=function(message){const item=message.companionCompletion||{},name=esc(item.name||companionActivityNameV35(item)),duration=esc(companionDurationLabelV31(item.actualSeconds));return '<article class="companion-completion-v31 companion-card-v35" data-companion-record="'+esc(String(message.id||''))+'"><i class="companion-scene-icon-v35">'+companionSceneIconV35(item.scene)+'</i><span class="companion-completion-kicker-v31">COMPANION · 完成</span><strong>'+name+'</strong><p>一起度过 '+duration+'</p><button type="button" data-companion-record="'+esc(String(message.id||''))+'">查看陪伴记录</button></article>'};
function injectCompanionCardsV35Styles(){if($('companionCardsStylesV35'))return;document.head.insertAdjacentHTML('beforeend','<style id="companionCardsStylesV35">.companion-card-v35{position:relative;text-align:center!important;background:color-mix(in srgb,var(--accent-pale) 54%,var(--chat-surface))!important;color:var(--chat-text)}.companion-scene-icon-v35{position:absolute;top:14px;left:15px;display:grid;place-items:center;width:25px;height:25px;color:var(--chat-accent)}.companion-scene-icon-v35 svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.companion-completion-v31.companion-card-v35{padding:18px 18px 17px}.companion-completion-v31.companion-card-v35 strong{font-size:19px}.companion-completion-v31.companion-card-v35 p{margin:10px 0 14px}.companion-completion-v31.companion-card-v35 button{display:inline-block;color:var(--chat-accent)}</style>')}
function requestedTaInvitationV35(userTurn){const text=(userTurn||[]).map(message=>String(message.content||'')).join(' ').replace(/\s+/g,' ').trim(),recent=[...messages].reverse().find(message=>message?.companionInvitation),explicit=/(?:发|创建|来)(?:给我)?(?:一张|一个)?(?:陪伴)?邀请(?:卡片|卡)?|(?:给我|帮我|请你).{0,10}(?:发|创建).{0,8}(?:陪伴)?邀请|测试.{0,6}邀请/.test(text),turnTaking=!!recent&&/(?:轮到你|现在到你|你给我发|到你给我发)/.test(text),retryMissing=!!recent&&/(?:还是|仍然|又)?(?:没有|没看到|没收到|不见).{0,8}(?:邀请)?卡片|卡片.{0,8}(?:没出来|没渲染|没发出来|没有)/.test(text);if(!explicit&&!turnTaking&&!retryMissing)return '';if(/背单词|词汇/.test(text))return 'vocabulary';if(/运动|锻炼/.test(text))return 'exercise';if(/睡|午休|晚安/.test(text))return 'sleep';if(/洗澡|沐浴|泡澡/.test(text))return 'bath';if(/自定义/.test(text))return 'custom';return recent?.companionInvitation?.scene||'study'}
requestAiReply=async function(){if(sending||!current)return;if(savingBubble){toast('消息正在发送，稍候再让 TA 回复');return}const groupId=pendingTurnGroupId||getPendingTurnGroupId(messages),userTurn=messages.filter(message=>message.role==='iris'&&message.replyGroupId===groupId);if(!groupId||!userTurn.length)return toast('先发一条消息吧');const requestedScene=requestedTaInvitationV35(userTurn);sending=true;replyLoadingV20={conversationId:current.id};updateReplyButton();renderMessages();scrollBottom();try{const data=await api('/api/chat/send',{method:'POST',body:JSON.stringify({conversationId:current.id,replyGroupId:groupId,settings})}),base=messages.slice();for(const message of data.userMessages||[]){const index=base.findIndex(item=>item.id===message.id);if(index>=0)base[index]=message;else base.push(message)}await revealAiMessagesV20(data.aiMessages||[],base);for(const message of data.systemMessages||[])if(!messages.some(item=>item.id===message.id))messages.push(message);const receivedCard=(data.aiMessages||[]).some(message=>message?.companionInvitation?.from==='ta');if(requestedScene&&!receivedCard){const fallback=await api('/api/chat/companion-invitations/ta',{method:'POST',body:JSON.stringify({conversationId:current.id,scene:requestedScene})});if(!messages.some(item=>item.id===fallback.id))messages.push(fallback)}pendingTurnGroupId='';await refreshConversationMeta();if(data.companionInvitationResult?.status==='accepted'){renderMessages();toast('TA 接受了邀请，正在进入陪伴房间','success');const source=messages.find(item=>String(item.id)===String(data.companionInvitationResult.sourceMessageId));setTimeout(()=>enterCompanionInvitationV32(source||{companionInvitation:{scene:data.companionInvitationResult.scene,config:data.companionInvitationResult.config}}),280)}else if(data.companionInvitationResult?.status==='declined'){renderMessages();toast('对方拒绝了这次邀请')}else{renderMessages();scrollBottom()}}catch(error){const delayed=/504|timeout|network|failed to fetch/i.test(error.message||'');replyLoadingV20=null;const systemMessages=Array.isArray(error.data?.systemMessages)?error.data.systemMessages:[];if(systemMessages.length){messages=mergeMessagesV20(messages,systemMessages);renderMessages();toast('回复未完成，失败原因与已保存的工具记录已写入聊天','error')}else{if(delayed)toast('连接较慢，回复若完成会自动出现');else toast('发送失败：'+error.message,'error');try{await syncOpenRoomV20()}catch{}}pendingTurnGroupId=getPendingTurnGroupId(messages)}finally{replyLoadingV20=null;sending=false;updateReplyButton();renderMessages();scrollBottom()}};
function attachCompanionReplyV35(){const button=$('askReplyBtn');if(button)button.onclick=requestAiReply}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectCompanionCardsV35Styles();attachCompanionReplyV35()});else{injectCompanionCardsV35Styles();attachCompanionReplyV35()}

/* V36: deterministic invitation fallback, transient request errors and a
   landing-page dock that does not reopen the last room. */
const apiV36Base=api;
api=async function(path,opt={}){
  try{return await apiV36Base(path,opt)}catch(error){
    if(/^\/api\/chat\/(?:send|messages\/[^/]+\/regenerate)/.test(String(path||''))){
      const raw=String(error?.message||'');
      if(/No available channel|\b503\b/i.test(raw))error.message='当前模型暂时没有可用通道，请稍后重试';
      else if(/timeout|timed out|\b504\b/i.test(raw))error.message='模型响应超时，请稍后重试';
      else if(/network|failed to fetch|load failed/i.test(raw))error.message='网络连接失败，请稍后重试';
      else error.message='本次回复失败，请稍后重试';
      error.data={...(error.data||{}),systemMessages:[]};
    }
    throw error;
  }
};
const groupMessagesV36Base=groupMessages;
groupMessages=function(list){return groupMessagesV36Base((Array.isArray(list)?list:[]).filter(message=>message?.systemType!=='chat_failure'))};
const requestAiReplyV36Base=requestAiReply;
requestAiReply=async function(){
  if(sending||!current)return;
  if(savingBubble){toast('消息正在发送，稍候再让 TA 回复');return}
  const groupId=pendingTurnGroupId||getPendingTurnGroupId(messages);
  const userTurn=messages.filter(message=>message.role==='iris'&&message.replyGroupId===groupId);
  const requestedScene=requestedTaInvitationV35(userTurn);
  if(!requestedScene)return requestAiReplyV36Base();
  sending=true;updateReplyButton();
  try{
    const card=await api('/api/chat/companion-invitations/ta',{method:'POST',body:JSON.stringify({conversationId:current.id,scene:requestedScene})});
    if(!messages.some(item=>item.id===card.id))messages.push(card);
    pendingTurnGroupId='';
    await refreshConversationMeta();
    renderMessages();scrollBottom();
  }catch(error){toast(error.message||'邀请卡片发送失败','error')}
  finally{sending=false;updateReplyButton()}
};
function attachReplyV36(){const button=$('askReplyBtn');if(button)button.onclick=requestAiReply}
function markChatLandingV36(){
  localStorage.removeItem(LAST_OPEN_ROOM_KEY_V22);
  localStorage.setItem('iris-last-route-v33',JSON.stringify({kind:'landing',at:Date.now()}));
  showLanding();
}
function attachChatLandingV36(){
  const dock=document.querySelector('.dock-center[href="chat.html"]');
  if(dock&&!dock.dataset.landingV36){
    dock.dataset.landingV36='true';
    dock.addEventListener('click',event=>{if(current)return;event.preventDefault();markChatLandingV36()});
  }
  const newChat=$('newChatBtn');
  if(newChat)newChat.onclick=markChatLandingV36;
  attachReplyV36();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachChatLandingV36);else attachChatLandingV36();

/* V37: companion invitations are a role-configurable model tool.  The chat
   composer remains the only manual entry point for companion rooms. */
if(!TOOL_GROUPS_V17.some(group=>group[1]?.includes('manage_companion_invitation'))){
  TOOL_GROUPS_V17.push(['陪伴',['manage_companion_invitation'],['发送或回应陪伴邀请']]);
}
const toolConfigV37Base=toolConfigV17;
toolConfigV17=function(value){
  const config=toolConfigV37Base(value),legacy=Number(value?.version||0)<2;
  if(legacy&&config.enabled&&!config.allowed.includes('manage_companion_invitation'))config.allowed.push('manage_companion_invitation');
  return config;
};
const persistToolConfigV37Base=persistToolConfigV17;
persistToolConfigV17=async function(config){return await persistToolConfigV37Base({...config,version:2})};
requestAiReply=requestAiReplyV36Base;
function disableRightCompanionEntryV37(){
  $('companionEntryV24')?.remove();
  ensureCompanionEntryV24=function(){$('companionEntryV24')?.remove()};
  const button=$('askReplyBtn');if(button)button.onclick=requestAiReply;
  if($('rightMenuPanel-toolsV17'))renderToolManagerV17();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',disableRightCompanionEntryV37);else disableRightCompanionEntryV37();

/* V38: keep companion invitation/completion cards visually aligned, and use
   the same upward reply affordance in the main chat as in a companion room. */
function injectCompanionCardSizingV38(){
  if($('companionCardSizingV38'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="companionCardSizingV38">.companion-invitation-v32.companion-card-v35,.companion-completion-v31.companion-card-v35{box-sizing:border-box;width:min(330px,88%);padding:15px 16px;border-radius:18px}.companion-completion-v31.companion-card-v35 strong{font-size:17px}.companion-completion-v31.companion-card-v35 p{margin:7px 0 12px}</style>');
}
const CHAT_REPLY_ARROW_V38='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function applyChatReplyArrowV38(){const button=$('askReplyBtn');if(button)button.innerHTML=CHAT_REPLY_ARROW_V38}
const initIconsV38Base=initIcons;
initIcons=function(){initIconsV38Base();applyChatReplyArrowV38()};
function initCompanionPolishV38(){injectCompanionCardSizingV38();applyChatReplyArrowV38()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCompanionPolishV38);else initCompanionPolishV38();

/* V40: virtual transfer cards and the composer entry point. */
if(!TOOL_GROUPS_V17.some(group=>group[1]?.includes('manage_transfer')))TOOL_GROUPS_V17.push(['转账',['manage_transfer'],['发送或回应虚拟转账']]);
function transferMoneyV40(value){return '¥'+Number(value||0).toFixed(2)}
function transferCardV40(message){const item=message.transfer||{},outgoing=item.from==='iris',pending=item.status==='pending',status=item.status==='received'?'已收款':item.status==='declined'?'已退回':outgoing?'待 TA 接收':'待你接收',actions=!outgoing&&pending?'<div class="transfer-actions-v40"><button type="button" data-transfer-accept="'+esc(String(message.id||''))+'">收下</button><button type="button" data-transfer-decline="'+esc(String(message.id||''))+'">退回</button></div>':'';return '<article class="transfer-card-v40 '+(outgoing?'outgoing':'incoming')+'"><span>TRANSFER · 虚拟转账</span><strong>'+transferMoneyV40(item.amount)+'</strong><p>'+esc(item.note||'给你的小心意')+'</p><footer>'+status+'</footer>'+actions+'</article>'}
const renderGroupV40Base=renderGroup;renderGroup=function(group,role){const first=group?.messages?.[0];if(first?.transfer)return '<div class="transfer-row-v40">'+transferCardV40(first)+'</div>';return renderGroupV40Base(group,role)};
function injectTransferStylesV40(){if($('transferStylesV40'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferStylesV40">.transfer-row-v40{display:flex;justify-content:center;margin:12px 0}.transfer-card-v40{width:min(335px,88%);overflow:hidden;border-radius:17px;background:#18ae68;color:#fff;box-shadow:0 6px 20px rgba(20,145,86,.24)}.transfer-card-v40>span{display:block;padding:13px 17px 0;color:rgba(255,255,255,.74);font:11px var(--font-b);letter-spacing:.08em}.transfer-card-v40 strong{display:block;padding:12px 17px 2px;font:400 34px/1 var(--font-d)}.transfer-card-v40 p{min-height:24px;margin:7px 17px 13px;color:rgba(255,255,255,.9);font:13px/1.5 var(--font-b)}.transfer-card-v40 footer{padding:10px 17px;border-top:1px solid rgba(255,255,255,.17);color:rgba(255,255,255,.76);font:13px var(--font-b)}.transfer-actions-v40{display:flex;gap:8px;padding:0 17px 14px}.transfer-actions-v40 button{flex:1;padding:8px;border:0;border-radius:9px;background:#fff;color:#129258;font:13px var(--font-b);cursor:pointer}.transfer-actions-v40 button+button{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.38)}.transfer-sheet-v40{position:fixed;z-index:1500;inset:0;display:none;align-items:flex-end;background:rgba(35,31,32,.32);backdrop-filter:blur(6px)}.transfer-sheet-v40.open{display:flex}.transfer-panel-v40{position:relative;box-sizing:border-box;width:100%;padding:12px 20px calc(24px + env(safe-area-inset-bottom));border-radius:27px 27px 0 0;background:var(--chat-surface);box-shadow:0 -12px 42px rgba(42,35,39,.18)}.transfer-panel-v40 h2{margin:7px 0 18px;font:400 25px var(--font-d);text-align:center}.transfer-panel-v40 label{display:grid;gap:7px;margin:12px 0;color:var(--chat-muted);font:13px var(--font-b)}.transfer-panel-v40 input{width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--chat-border);border-radius:12px;background:var(--chat-bg);color:var(--chat-text);font:15px var(--font-b)}.transfer-panel-v40 .primary{width:100%;margin-top:9px;padding:13px;border:0;border-radius:13px;background:#18ae68;color:#fff;font:15px var(--font-b);cursor:pointer}.transfer-panel-v40 .close{position:absolute;right:22px;border:0;background:transparent;color:var(--chat-muted);font-size:24px;cursor:pointer}.transfer-add-icon-v40{color:#18ae68!important;background:color-mix(in srgb,#18ae68 14%,var(--accent-pale))!important}</style>')}
function ensureTransferSheetV40(){if($('transferSheetV40'))return;document.body.insertAdjacentHTML('beforeend','<section class="transfer-sheet-v40" id="transferSheetV40"><div class="transfer-panel-v40"><button class="close" type="button" data-transfer-close>×</button><h2>转账给 TA</h2><label>金额<input id="transferAmountV40" type="number" min="0.01" max="999999.99" step="0.01" inputmode="decimal" placeholder="¥ 0.00"></label><label>备注（可选）<input id="transferNoteV40" maxlength="80" placeholder="给 TA 的一句话"></label><button class="primary" id="transferSendV40" type="button">确认转账</button></div></section>');const sheet=$('transferSheetV40');sheet.onclick=e=>{if(e.target===sheet||e.target.closest('[data-transfer-close]'))sheet.classList.remove('open')};$('transferSendV40').onclick=async()=>{if(!current)return toast('请先进入一个聊天房间');const amount=Number($('transferAmountV40').value),note=$('transferNoteV40').value.trim();if(!(amount>=.01&&amount<=999999.99))return toast('请输入有效金额','error');const button=$('transferSendV40');try{button.disabled=true;button.textContent='转账中…';const card=await api('/api/chat/transfers',{method:'POST',body:JSON.stringify({conversationId:current.id,amount,note})});messages.push(card);pendingTurnGroupId=card.replyGroupId;sheet.classList.remove('open');$('transferAmountV40').value='';$('transferNoteV40').value='';renderMessages();scrollBottom();await requestAiReply()}catch(error){toast(error.message||'转账失败','error')}finally{button.disabled=false;button.textContent='确认转账'}}}
function ensureTransferAddMenuV40(){let menu=$('companionAddMenuV32');if(menu?.classList.contains('transfer-add-menu-v40'))return menu;if(menu)menu.remove();document.body.insertAdjacentHTML('beforeend','<div class="companion-add-menu-v34 transfer-add-menu-v40" id="companionAddMenuV32" aria-hidden="true"><button type="button" class="companion-add-backdrop-v34" data-add-close aria-label="关闭"></button><section class="companion-add-sheet-v34"><div class="companion-add-grab-v34"></div><div class="companion-add-grid-v34"><button type="button" data-add-image><i>'+ICON.image+'</i><span>图片</span></button><button type="button" data-add-companion><i>'+companionIconV24()+'</i><span>陪伴</span></button><button type="button" data-add-transfer><i class="transfer-add-icon-v40">¥</i><span>转账</span></button></div></section></div>');menu=$('companionAddMenuV32');const close=()=>{menu.classList.remove('open');menu.setAttribute('aria-hidden','true')};menu.querySelector('[data-add-close]').onclick=close;menu.querySelector('[data-add-image]').onclick=()=>{close();$('imageInput').click()};menu.querySelector('[data-add-companion]').onclick=()=>{close();openCompanionInviteV32()};menu.querySelector('[data-add-transfer]').onclick=()=>{close();ensureTransferSheetV40();$('transferSheetV40').classList.add('open');setTimeout(()=>$('transferAmountV40').focus(),180)};return menu}
ensureCompanionAddMenuV34=ensureTransferAddMenuV40;
document.addEventListener('click',async event=>{const button=event.target.closest('[data-transfer-accept],[data-transfer-decline]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();try{const data=await api('/api/chat/transfers/'+encodeURIComponent(button.dataset.transferAccept||button.dataset.transferDecline)+'/respond',{method:'POST',body:JSON.stringify({conversationId:current?.id||'',action:button.dataset.transferAccept?'accept':'decline'})}),updated=data.transfer||data;messages=messages.map(item=>String(item.id)===String(updated.id)?updated:item);if(data.systemMessage&&!messages.some(item=>String(item.id)===String(data.systemMessage.id)))messages.push(data.systemMessage);if(data.receiptMessage&&!messages.some(item=>String(item.id)===String(data.receiptMessage.id)))messages.push(data.receiptMessage);closeTransferDetailV45?.();renderMessages();scrollBottom();toast(button.dataset.transferAccept?'已收下转账':'已退回转账')}catch(error){toast(error.message||'操作失败','error')}},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectTransferStylesV40();ensureTransferSheetV40();ensureToolManagerV17()});else{injectTransferStylesV40();ensureTransferSheetV40();ensureToolManagerV17()}

/* V41: transfers live in the normal two-sided conversation, and the add
   panel opens beneath the composer like a chat attachment tray. */
const TRANSFER_ARROWS_ICON_V41='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10M14 4l3 3-3 3M17 17H7M10 20l-3-3 3-3"/></svg>';
function transferCardV41(message){
  const item=message.transfer||{},outgoing=item.from==='iris',pending=item.status==='pending';
  const status=item.status==='received'?'已收款':item.status==='declined'?'已退回':outgoing?'待 TA 接收':'待你接收';
  const actions=!outgoing&&pending?'<div class="transfer-actions-v41"><button type="button" data-transfer-accept="'+esc(String(message.id||''))+'">收下</button><button type="button" data-transfer-decline="'+esc(String(message.id||''))+'">退回</button></div>':'';
  return '<article class="transfer-card-v41 '+(outgoing?'outgoing':'incoming')+'"><header><i>'+TRANSFER_ARROWS_ICON_V41+'</i><strong>'+transferMoneyV40(item.amount)+'</strong></header><p>'+esc(item.note||'给你的小心意')+'</p><footer>'+status+'</footer>'+actions+'</article>';
}
function renderTransferGroupV41(group,role){
  const user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(group.messages[0].createdAt);
  const person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>';
  const card='<div class="bubble-stack transfer-stack-v41">'+transferCardV41(group.messages[0])+'</div>';
  return '<div class="message-group transfer-message-v41 '+(user?'user':'assistant')+'">'+(user?card+person:person+card)+'</div>';
}
const renderGroupV41Base=renderGroup;
renderGroup=function(group,role){return group?.messages?.[0]?.transfer?renderTransferGroupV41(group,role):renderGroupV41Base(group,role)};
function injectTransferStylesV41(){if($('transferStylesV41'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferStylesV41">.transfer-message-v41{margin:1px 0}.transfer-stack-v41{width:auto!important;max-width:min(300px,calc(100% - 2px))!important}.transfer-card-v41{width:min(290px,100%);overflow:hidden;border-radius:15px;background:#18ae68;color:#fff;box-shadow:0 6px 17px rgba(20,145,86,.22)}.transfer-card-v41 header{display:flex;align-items:center;gap:10px;padding:17px 16px 5px}.transfer-card-v41 header i{display:grid;place-items:center;width:31px;height:31px;flex:none;border:1.4px solid rgba(255,255,255,.9);border-radius:50%;color:#fff}.transfer-card-v41 header svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.transfer-card-v41 header strong{font:400 29px/1 var(--font-d);letter-spacing:.01em}.transfer-card-v41 p{min-height:21px;margin:6px 16px 14px;color:rgba(255,255,255,.9);font:13px/1.5 var(--font-b);word-break:break-word}.transfer-card-v41 footer{padding:10px 16px;border-top:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.8);font:12px var(--font-b)}.transfer-actions-v41{display:flex;gap:8px;padding:0 13px 12px}.transfer-actions-v41 button{flex:1;padding:8px;border:0;border-radius:8px;background:#fff;color:#159c5c;font:13px var(--font-b);cursor:pointer}.transfer-actions-v41 button+button{border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.15);color:#fff}.transfer-add-menu-v41{position:fixed;z-index:145;inset:0;visibility:hidden;pointer-events:none}.transfer-add-menu-v41.open{visibility:visible;pointer-events:auto}.transfer-add-menu-v41 .transfer-add-backdrop-v41{position:absolute;inset:0 0 var(--chat-add-panel-height,254px);width:100%;padding:0;border:0;background:rgba(35,31,32,.16);opacity:0;transition:opacity .18s}.transfer-add-menu-v41.open .transfer-add-backdrop-v41{opacity:1}.transfer-add-panel-v41{position:absolute;right:0;bottom:0;left:0;box-sizing:border-box;min-height:var(--chat-add-panel-height,254px);padding:25px 24px calc(23px + env(safe-area-inset-bottom));border-top:1px solid var(--chat-border);background:var(--chat-bg);transform:translateY(105%);transition:transform .22s ease}.transfer-add-menu-v41.open .transfer-add-panel-v41{transform:none}.transfer-add-grid-v41{display:grid;grid-template-columns:repeat(4,1fr);gap:23px 16px;max-width:520px;margin:auto}.transfer-add-grid-v41 button{display:grid;justify-items:center;gap:8px;padding:0;border:0;background:transparent;color:var(--chat-text);font:13px var(--font-b);cursor:pointer}.transfer-add-grid-v41 i{display:grid;place-items:center;width:57px;height:57px;border-radius:15px;background:var(--chat-surface);color:var(--chat-accent);box-shadow:var(--shadow-xs)}.transfer-add-grid-v41 i svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.transfer-add-grid-v41 .transfer-add-icon-v41{color:#18ae68;background:color-mix(in srgb,#18ae68 13%,var(--chat-surface))}.chat-room.chat-add-open-v41 .composer{bottom:calc(var(--chat-add-panel-height,254px) + env(safe-area-inset-bottom))!important;z-index:150;background:var(--chat-bg);transition:bottom .22s ease}.chat-room.chat-add-open-v41 .chat-main{padding-bottom:calc(var(--chat-add-panel-height,254px) + 142px)!important}</style>')}
function ensureTransferAddMenuV41(){
  let menu=$('companionAddMenuV32');if(menu?.classList.contains('transfer-add-menu-v41'))return menu;if(menu)menu.remove();
  document.body.insertAdjacentHTML('beforeend','<div class="transfer-add-menu-v41" id="companionAddMenuV32" aria-hidden="true"><button type="button" class="transfer-add-backdrop-v41" data-add-close aria-label="关闭"></button><section class="transfer-add-panel-v41"><div class="transfer-add-grid-v41"><button type="button" data-add-image><i>'+ICON.image+'</i><span>图片</span></button><button type="button" data-add-companion><i>'+companionIconV24()+'</i><span>陪伴</span></button><button type="button" data-add-transfer><i class="transfer-add-icon-v41">'+TRANSFER_ARROWS_ICON_V41+'</i><span>转账</span></button></div></section></div>');
  menu=$('companionAddMenuV32');const close=()=>{menu.classList.remove('open');menu.setAttribute('aria-hidden','true');document.body.classList.remove('chat-add-open-v41')};
  menu.querySelector('[data-add-close]').onclick=close;
  menu.querySelector('[data-add-image]').onclick=()=>{close();$('imageInput').click()};
  menu.querySelector('[data-add-companion]').onclick=()=>{close();openCompanionInviteV32()};
  menu.querySelector('[data-add-transfer]').onclick=()=>{close();ensureTransferSheetV40();$('transferSheetV40').classList.add('open');setTimeout(()=>$('transferAmountV40').focus(),180)};
  return menu;
}
ensureCompanionAddMenuV34=function(){return ensureTransferAddMenuV41()};
openCompanionAddMenuV32=function(){const menu=ensureTransferAddMenuV41(),opening=!menu.classList.contains('open');menu.classList.toggle('open',opening);menu.setAttribute('aria-hidden',String(!opening));document.body.classList.toggle('chat-add-open-v41',opening)};
const attachCompanionAddButtonV41Base=attachCompanionAddButtonV34;
attachCompanionAddButtonV34=function(){attachCompanionAddButtonV41Base();const button=$('addImage');if(button&&!button.dataset.transferTrayV41){button.dataset.transferTrayV41='true';button.onclick=()=>{const menu=ensureTransferAddMenuV41(),opening=!menu.classList.contains('open');menu.classList.toggle('open',opening);menu.setAttribute('aria-hidden',String(!opening));document.body.classList.toggle('chat-add-open-v41',opening)}}};
function stopAutomaticTransferReplyV41(){const send=$('transferSendV40');if(!send||send.dataset.manualReplyV41)return;send.dataset.manualReplyV41='true';send.onclick=async()=>{if(!current)return toast('请先进入一个聊天房间');const amount=Number($('transferAmountV40').value),note=$('transferNoteV40').value.trim();if(!(amount>=.01&&amount<=999999.99))return toast('请输入有效金额','error');try{send.disabled=true;send.textContent='转账中…';const card=await api('/api/chat/transfers',{method:'POST',body:JSON.stringify({conversationId:current.id,amount,note})});messages.push(card);pendingTurnGroupId=card.replyGroupId;$('transferSheetV40').classList.remove('open');$('transferAmountV40').value='';$('transferNoteV40').value='';renderMessages();scrollBottom();toast('已发送，等待 TA 接收','success')}catch(error){toast(error.message||'转账失败','error')}finally{send.disabled=false;send.textContent='确认转账'}}}
function initTransferPolishV41(){injectTransferStylesV41();ensureTransferAddMenuV41();attachCompanionAddButtonV34();ensureTransferSheetV40();stopAutomaticTransferReplyV41()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTransferPolishV41);else initTransferPolishV41();

/* V42: a transfer is always its own chat item.  This prevents a later text
   bubble in the same pending turn from being hidden behind the card. */
const groupMessagesV42Base=groupMessages;
groupMessages=function(list){
  const grouped=groupMessagesV42Base(list),result=[];
  for(const group of grouped){
    const parts=[];let part=[];
    for(const message of group.messages||[]){
      if(part.length&&(message?.transfer||part.at(-1)?.transfer)){parts.push(part);part=[]}
      part.push(message);
    }
    if(part.length)parts.push(part);
    for(const messagesPart of parts)result.push({...group,messages:messagesPart,last:messagesPart.at(-1)});
  }
  return result;
};
function transferCardV42(message){
  const item=message.transfer||{},outgoing=item.from==='iris',pending=item.status==='pending';
  const status=item.status==='received'?'已收款':item.status==='declined'?'已退回':outgoing?'待 TA 接收':'待你接收';
  const actions=!outgoing&&pending?'<div class="transfer-actions-v41"><button type="button" data-transfer-accept="'+esc(String(message.id||''))+'">收下</button><button type="button" data-transfer-decline="'+esc(String(message.id||''))+'">退回</button></div>':'';
  return '<article class="transfer-card-v41" data-transfer-message-id="'+esc(String(message.id||''))+'"><header><i>'+TRANSFER_ARROWS_ICON_V41+'</i><strong>'+transferMoneyV40(item.amount)+'</strong></header><p>'+esc(item.note||'给你的小心意')+'</p><footer>'+status+'</footer>'+actions+'</article>';
}
transferCardV41=transferCardV42;
function injectTransferStylesV42(){if($('transferStylesV42'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferStylesV42">.transfer-stack-v41{max-width:min(365px,calc(100% - 2px))!important}.transfer-card-v41{width:min(355px,100%);min-height:198px;background:#39bd7c}.transfer-card-v41 header{padding:22px 20px 8px;gap:12px}.transfer-card-v41 header i{width:39px;height:39px}.transfer-card-v41 header svg{width:24px;height:24px}.transfer-card-v41 header strong{font-size:34px}.transfer-card-v41 p{margin:10px 20px 25px;font-size:14px}.transfer-card-v41 footer{padding:12px 20px;font-size:13px}.transfer-card-v41[data-transfer-message-id]{touch-action:manipulation}.transfer-add-panel-v41{background:#f5f6f6}.transfer-add-grid-v41 i,.transfer-add-grid-v41 .transfer-add-icon-v41{background:#fff;color:var(--chat-accent)}.composer-box .ask-reply.active{background:var(--chat-surface);border-color:var(--chat-border);color:var(--chat-accent)}</style>')}
function setupTransferLongPressV42(){
  if(document.documentElement.dataset.transferLongPressV42)return;document.documentElement.dataset.transferLongPressV42='true';
  let hold=null;const cancel=()=>{if(hold){clearTimeout(hold.timer);hold=null}};
  document.addEventListener('pointerdown',event=>{const card=event.target.closest('[data-transfer-message-id]');if(!card||event.button>0||event.target.closest('button'))return;hold={card,pointerId:event.pointerId,x:event.clientX,y:event.clientY,timer:setTimeout(()=>{if(!hold)return;showMessageActionsV3(hold.card.dataset.transferMessageId,hold.card);window.__transferLongPressAtV45=Date.now();navigator.vibrate?.(12);hold=null},520)}});
  document.addEventListener('pointermove',event=>{if(hold&&hold.pointerId===event.pointerId&&(Math.abs(event.clientX-hold.x)>12||Math.abs(event.clientY-hold.y)>12))cancel()});
  document.addEventListener('pointerup',cancel);document.addEventListener('pointercancel',cancel);
  document.addEventListener('contextmenu',event=>{const card=event.target.closest('[data-transfer-message-id]');if(!card)return;event.preventDefault();showMessageActionsV3(card.dataset.transferMessageId,card)});
}
const apiV42Base=api;
api=async function(path,opt={}){try{return await apiV42Base(path,opt)}catch(error){if(String(path)==='/api/chat/send'&&error?.message==='本次回复失败，请稍后重试'){const detail=String(error?.data?.error||'').replace(/\s+/g,' ').trim();if(detail)error.message='回复失败：'+detail.slice(0,140)}throw error}};
function initTransferFixesV42(){injectTransferStylesV42();setupTransferLongPressV42()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTransferFixesV42);else initTransferFixesV42();

/* V43: a transfer reads as a wide, compact payment strip; the composer area
   intentionally stays neutral instead of inheriting the room theme color. */
function injectTransferLayoutV43(){if($('transferLayoutV43'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferLayoutV43">.transfer-stack-v41{max-width:min(440px,calc(100% - 2px))!important}.transfer-card-v41{width:min(420px,100%);min-height:0;background:#43bd85}.transfer-card-v41 header{padding:15px 18px 5px;gap:10px}.transfer-card-v41 header i{width:34px;height:34px}.transfer-card-v41 header svg{width:21px;height:21px}.transfer-card-v41 header strong{font-size:31px}.transfer-card-v41 p{min-height:0;margin:6px 18px 11px;font-size:13px}.transfer-card-v41 footer{padding:10px 18px;font-size:12px}.chat-room .composer,.chat-room.chat-add-open-v41 .composer{background:#f5f6f6!important}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectTransferLayoutV43);else injectTransferLayoutV43();

/* V44: transfer-card colour is a room appearance setting, alongside bubble
   colours, so every conversation can keep its own little ledger palette. */
const TRANSFER_CARD_DEFAULT_COLOR_V44='#43BD85';
function ensureTransferCardColorSettingV44(){
  const panel=$('rightMenuPanel-beauty'),anchor=$('aiBubble')?.closest('.setting-row');if(!panel||!anchor||$('transferCardColorV44'))return;
  anchor.insertAdjacentHTML('afterend','<label class="setting-row" id="transferCardColorRowV44"><span>转账卡片</span><input id="transferCardColorV44" type="color" aria-label="转账卡片颜色"></label>');
  const input=$('transferCardColorV44');
  input.oninput=()=>document.documentElement.style.setProperty('--chat-transfer-card-color',input.value);
  input.onchange=async()=>{if(!current)return;const appearance={...(current.appearance||{}),transferCardColor:input.value};try{await updateConversation(current.id,{appearance});applyAppearance();toast('转账卡片颜色已保存','success')}catch(error){toast('保存设置失败：'+error.message,'error')}};
}
function hydrateTransferCardColorSettingV44(){
  ensureTransferCardColorSettingV44();const input=$('transferCardColorV44'),color=roomHexV14(current?.appearance?.transferCardColor,TRANSFER_CARD_DEFAULT_COLOR_V44);if(input)input.value=color;
}
const applyAppearanceV44Base=applyAppearance;
applyAppearance=function(){applyAppearanceV44Base();const color=roomHexV14(current?.appearance?.transferCardColor,TRANSFER_CARD_DEFAULT_COLOR_V44);document.documentElement.style.setProperty('--chat-transfer-card-color',color)};
const hydrateRightV44Base=hydrateRight;
hydrateRight=function(){hydrateRightV44Base();hydrateTransferCardColorSettingV44();applyAppearance()};
function injectTransferColourV44(){if($('transferColourV44'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferColourV44">.transfer-card-v41{background:var(--chat-transfer-card-color,'+TRANSFER_CARD_DEFAULT_COLOR_V44+')}.transfer-card-v41{transition:background-color .16s ease}</style>')}
function initTransferColourV44(){injectTransferColourV44();ensureTransferCardColorSettingV44();hydrateTransferCardColorSettingV44();applyAppearance()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTransferColourV44);else initTransferColourV44();

/* V45: transfer cards open into a focused detail view before Iris decides. */
function transferHexV45(value,fallback=TRANSFER_CARD_DEFAULT_COLOR_V44){const text=String(value||'').trim().replace(/^#/,'');return /^[0-9a-f]{6}$/i.test(text)?'#'+text.toUpperCase():fallback}
async function persistTransferColorV45(value){if(!current)return;const appearance={...(current.appearance||{}),transferCardColor:value};try{await updateConversation(current.id,{appearance});applyAppearance();toast('转账卡片颜色已保存','success')}catch(error){toast('保存设置失败：'+error.message,'error')}}
function ensureTransferColorCodeV45(){const color=$('transferCardColorV44'),row=$('transferCardColorRowV44');if(!color||!row)return;if(!$('transferCardColorCodeV45'))row.insertAdjacentHTML('beforeend','<input class="colour-code-input" id="transferCardColorCodeV45" type="text" inputmode="text" maxlength="7" autocomplete="off" spellcheck="false" placeholder="43BD85" aria-label="转账卡片颜色代码">');const code=$('transferCardColorCodeV45'),sync=()=>{const hex=transferHexV45(color.value);color.value=hex;code.value=hex.slice(1)};color.oninput=()=>{sync();document.documentElement.style.setProperty('--chat-transfer-card-color',color.value)};color.onchange=()=>persistTransferColorV45(color.value);code.onchange=()=>{const hex=transferHexV45(code.value,color.value);color.value=hex;sync();document.documentElement.style.setProperty('--chat-transfer-card-color',hex);persistTransferColorV45(hex)};sync()}
function hydrateTransferColorCodeV45(){hydrateTransferCardColorSettingV44();const color=$('transferCardColorV44'),code=$('transferCardColorCodeV45');if(color&&code)code.value=transferHexV45(current?.appearance?.transferCardColor,color.value).slice(1)}
const hydrateRightV45Base=hydrateRight;
hydrateRight=function(){hydrateRightV45Base();ensureTransferColorCodeV45();hydrateTransferColorCodeV45()};
function transferCardV45(message){const item=message.transfer||{},outgoing=item.from==='iris',status=item.status==='received'?'已收款':item.status==='declined'?'已退回':outgoing?'待 TA 接收':'待你接收';return '<article class="transfer-card-v41 '+(outgoing?'outgoing':'incoming')+'" data-transfer-message-id="'+esc(String(message.id||''))+'" data-transfer-open-v45="'+(!outgoing?'true':'false')+'"><header><i>'+TRANSFER_ARROWS_ICON_V41+'</i><strong>'+transferMoneyV40(item.amount)+'</strong></header><p>'+esc(item.note||'给你的小心意')+'</p><footer>'+status+'</footer></article>'}
transferCardV41=transferCardV45;
function transferDetailDateV45(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function ensureTransferDetailV45(){if($('transferDetailV45'))return;document.body.insertAdjacentHTML('beforeend','<section class="transfer-detail-v45" id="transferDetailV45" aria-hidden="true"><button type="button" class="transfer-detail-backdrop-v45" data-transfer-detail-close aria-label="关闭"></button><article class="transfer-detail-card-v45" role="dialog" aria-modal="true" aria-labelledby="transferDetailTitleV45"><button type="button" class="transfer-detail-close-v45" data-transfer-detail-close aria-label="关闭">×</button><div id="transferDetailContentV45"></div></article></section>');const sheet=$('transferDetailV45');sheet.addEventListener('click',event=>{if(event.target.closest('[data-transfer-detail-close]'))closeTransferDetailV45()})}
function closeTransferDetailV45(){const sheet=$('transferDetailV45');if(sheet){sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true')}}
function openTransferDetailV45(message){const item=message?.transfer;if(!item||item.from!=='ta')return;ensureTransferDetailV45();const pending=item.status==='pending',status=item.status==='received'?'已收款':item.status==='declined'?'已退回':'等待你的处理',answer=pending?'<div class="transfer-detail-actions-v45"><button type="button" data-transfer-accept="'+esc(String(message.id||''))+'">收下</button><button type="button" data-transfer-decline="'+esc(String(message.id||''))+'">退回</button></div>':'<p class="transfer-detail-done-v45">这笔转账已'+(item.status==='received'?'收下':'退回')+'</p>';const responded=item.respondedAt?'<div class="transfer-detail-row-v45"><span>'+(item.status==='received'?'收款时间':'退回时间')+'</span><strong>'+esc(transferDetailDateV45(item.respondedAt))+'</strong></div>':'';$('transferDetailContentV45').innerHTML='<div class="transfer-detail-icon-v45">'+TRANSFER_ARROWS_ICON_V41+'</div><h2 id="transferDetailTitleV45">'+esc((roles.find(role=>role.id===current?.roleId)?.name||'TA'))+' 向你转账</h2><strong class="transfer-detail-money-v45">'+transferMoneyV40(item.amount)+'</strong><p class="transfer-detail-note-v45">'+esc(item.note||'给你的小心意')+'</p><p class="transfer-detail-status-v45">'+status+'</p><div class="transfer-detail-lines-v45"><div class="transfer-detail-row-v45"><span>转账时间</span><strong>'+esc(transferDetailDateV45(message.createdAt))+'</strong></div>'+responded+'</div>'+answer;const sheet=$('transferDetailV45');sheet.classList.add('open');sheet.setAttribute('aria-hidden','false')}
document.addEventListener('click',event=>{const card=event.target.closest('[data-transfer-open-v45="true"]');if(!card||Date.now()-Number(window.__transferLongPressAtV45||0)<700)return;const message=messages.find(item=>String(item.id)===String(card.dataset.transferMessageId));if(message)openTransferDetailV45(message)});
function injectTransferDetailStylesV45(){if($('transferDetailStylesV45'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferDetailStylesV45">#transferCardColorRowV44{gap:10px}#transferCardColorRowV44 .colour-code-input{width:112px;min-width:0;text-transform:uppercase}.transfer-stack-v41{max-width:min(510px,calc(100% - 2px))!important}.transfer-card-v41{width:min(480px,100%)}.transfer-card-v41.incoming{cursor:pointer}.transfer-detail-v45{position:fixed;z-index:1700;inset:0;display:none;background:#fff}.transfer-detail-v45.open{display:block}.transfer-detail-backdrop-v45{position:absolute;inset:0;width:100%;border:0;background:rgba(27,25,25,.08)}.transfer-detail-card-v45{position:relative;box-sizing:border-box;width:min(560px,100%);min-height:100%;margin:auto;padding:62px 34px max(44px,env(safe-area-inset-bottom));background:#fff;color:#222;text-align:center}.transfer-detail-close-v45{position:absolute;top:20px;right:22px;width:38px;height:38px;border:0;border-radius:50%;background:#f5f5f5;color:#777;font-size:27px;line-height:1;cursor:pointer}.transfer-detail-icon-v45{display:grid;place-items:center;width:78px;height:78px;margin:13px auto 40px;border-radius:50%;background:var(--chat-transfer-card-color,'+TRANSFER_CARD_DEFAULT_COLOR_V44+');color:#fff}.transfer-detail-icon-v45 svg{width:42px;height:42px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.transfer-detail-card-v45 h2{margin:0;color:#252525;font:500 19px var(--font-b)}.transfer-detail-money-v45{display:block;margin:22px 0 13px;color:#171717;font:400 52px/1 var(--font-d)}.transfer-detail-note-v45{margin:0;color:#777;font:15px/1.55 var(--font-b)}.transfer-detail-status-v45{margin:13px 0 44px;color:#55705f;font:600 15px var(--font-b)}.transfer-detail-lines-v45{margin-top:0;border-top:1px solid #ececec;text-align:left}.transfer-detail-row-v45{display:flex;justify-content:space-between;gap:20px;padding:18px 0;border-bottom:1px solid #f0f0f0;color:#777;font:14px var(--font-b)}.transfer-detail-row-v45 strong{color:#2d2d2d;font-weight:500;text-align:right}.transfer-detail-actions-v45{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:37px}.transfer-detail-actions-v45 button{padding:14px;border:0;border-radius:13px;background:var(--chat-transfer-card-color,'+TRANSFER_CARD_DEFAULT_COLOR_V44+');color:#fff;font:15px var(--font-b);cursor:pointer}.transfer-detail-actions-v45 button+button{background:#f1f1f1;color:#555}.transfer-detail-done-v45{margin:36px 0 0;color:#777;font:14px var(--font-b)}</style>')}
function initTransferDetailsV45(){injectTransferDetailStylesV45();ensureTransferCardColorSettingV44();ensureTransferColorCodeV45();hydrateTransferColorCodeV45()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTransferDetailsV45);else initTransferDetailsV45();

/* V46: transfer width must not collapse on the outgoing side; details are a
   floating card over the conversation rather than a separate full page. */
function injectTransferFloatingV46(){if($('transferFloatingV46'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferFloatingV46">.message-group .transfer-stack-v41{width:min(480px,calc(100vw - 76px))!important;max-width:min(480px,calc(100vw - 76px))!important}.transfer-stack-v41 .transfer-card-v41{width:100%;box-sizing:border-box}.transfer-detail-v45{align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:rgba(31,29,29,.26);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}.transfer-detail-v45.open{display:flex}.transfer-detail-card-v45{width:min(490px,100%);min-height:0;max-height:calc(100dvh - 40px);margin:0;padding:30px 26px 28px;overflow:auto;border-radius:27px;background:#fff;box-shadow:0 18px 50px rgba(30,25,25,.2)}.transfer-detail-backdrop-v45{background:transparent}.transfer-detail-close-v45{top:13px;right:13px;width:34px;height:34px;font-size:24px}.transfer-detail-icon-v45{width:65px;height:65px;margin:8px auto 22px}.transfer-detail-icon-v45 svg{width:34px;height:34px}.transfer-detail-card-v45 h2{font-size:18px}.transfer-detail-money-v45{margin:16px 0 9px;font-size:45px}.transfer-detail-status-v45{margin:10px 0 24px}.transfer-detail-row-v45{padding:14px 0;font-size:13px}.transfer-detail-actions-v45{margin-top:24px}.transfer-detail-actions-v45 button{padding:12px}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectTransferFloatingV46);else injectTransferFloatingV46();

/* V47: a completed transfer is echoed as a clean, no-note receipt card. */
requestedTaInvitationV35=()=>'';
function transferStatusLabelV47(item){
  // 原转账卡记录的是付款方的视角；回传凭证卡记录的是实际收款方的视角。
  // 因此同一笔已完成转账必须分别显示“已被接收”和“已收款”。
  if(item.receipt)return item.status==='received'?'已收款':'已退回';
  return item.status==='received'?'已被接收':item.status==='declined'?'已退回':item.from==='iris'?'待 TA 接收':'待你接收';
}
function transferCardV47(message){
  const item=message.transfer||{},outgoing=item.from==='iris',receipt=!!item.receipt;
  return '<article class="transfer-card-v41 '+(outgoing?'outgoing':'incoming')+(receipt?' transfer-receipt-v47':'')+'" data-transfer-message-id="'+esc(String(message.id||''))+'" data-transfer-open-v45="'+(!outgoing&&!receipt?'true':'false')+'"><header><i>'+TRANSFER_ARROWS_ICON_V41+'</i><strong>'+transferMoneyV40(item.amount)+'</strong></header>'+(receipt?'':'<p>'+esc(item.note||'给你的小心意')+'</p>')+'<footer>'+transferStatusLabelV47(item)+'</footer></article>';
}
transferCardV41=transferCardV47;
function injectTransferReceiptsV47(){if($('transferReceiptsV47'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferReceiptsV47">.transfer-card-v41.transfer-receipt-v47 header{padding-bottom:9px}.transfer-card-v41.transfer-receipt-v47 footer{padding-top:4px;border-top:0;color:#fff;font-size:13px}.transfer-card-v41.transfer-receipt-v47{min-height:0}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectTransferReceiptsV47);else injectTransferReceiptsV47();

/* V48: every AI tool is opt-in from the right drawer; keep payment cards wide
   but not edge-to-edge on a phone. */
toolConfigV17=toolConfigV37Base;
persistToolConfigV17=async function(config){return await persistToolConfigV37Base({...config,version:3})};
const chatActionsV48=TOOL_GROUPS_V17.find(group=>group[0]==='聊天动作');
if(chatActionsV48){const index=chatActionsV48[1].indexOf('recall_own_message');if(index>=0){chatActionsV48[1].splice(index,1);chatActionsV48[2].splice(index,1)}}
if(!TOOL_GROUPS_V17.some(group=>group[1]?.includes('recall_own_message')))TOOL_GROUPS_V17.push(['撤回',['recall_own_message'],['撤回 TA 的旧消息']]);
function injectTransferWidthV48(){if($('transferWidthV48'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferWidthV48">.message-group .transfer-stack-v41{width:min(430px,calc(100vw - 100px))!important;max-width:min(430px,calc(100vw - 100px))!important}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectTransferWidthV48();renderToolManagerV17?.()});else{injectTransferWidthV48();renderToolManagerV17?.()}

/* V49: transfer cards have their own room-level width control; AI recall is
   no longer exposed in the drawer. */
for(let i=TOOL_GROUPS_V17.length-1;i>=0;i--){const group=TOOL_GROUPS_V17[i],index=group[1]?.indexOf('recall_own_message')??-1;if(index>=0){group[1].splice(index,1);group[2].splice(index,1)}if(!group[1]?.length)TOOL_GROUPS_V17.splice(i,1)}
function transferWidthV49(value){return roomNumberV16(value,55,100,84)}
function applyTransferWidthV49(value){const percent=transferWidthV49(value),available=Math.max(190,window.innerWidth-100);document.documentElement.style.setProperty('--chat-transfer-width-v49',Math.round(available*percent/100)+'px');const label=$('transferWidthValueV49');if(label)label.textContent=percent+'%'}
function ensureTransferWidthControlV49(){const bubble=$('bubbleWidth'),row=bubble?.closest('.setting-row');if(!row||$('transferCardWidthV49'))return;row.insertAdjacentHTML('afterend','<label class="setting-row" id="transferCardWidthRowV49"><span>转账卡片宽度<small id="transferWidthValueV49"></small></span><input id="transferCardWidthV49" type="range" min="55" max="100" step="1" value="84"></label>');const input=$('transferCardWidthV49');input.oninput=()=>applyTransferWidthV49(input.value);input.onchange=async()=>{if(!current)return;const appearance={...(current.appearance||{}),transferCardWidth:transferWidthV49(input.value)};try{await updateConversation(current.id,{appearance});current.appearance=appearance;applyTransferWidthV49(input.value);toast('转账卡片宽度已保存','success')}catch(error){toast('保存设置失败：'+error.message,'error')}}}
function hydrateTransferWidthV49(){ensureTransferWidthControlV49();const input=$('transferCardWidthV49'),value=transferWidthV49(current?.appearance?.transferCardWidth);if(input)input.value=value;applyTransferWidthV49(value)}
const hydrateRightV49Base=hydrateRight;hydrateRight=function(){hydrateRightV49Base();hydrateTransferWidthV49();renderToolManagerV17?.()};
const applyAppearanceV49Base=applyAppearance;applyAppearance=function(){applyAppearanceV49Base();applyTransferWidthV49(current?.appearance?.transferCardWidth)};
function injectTransferRefinementV49(){if($('transferRefinementV49'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferRefinementV49">.message-group .transfer-stack-v41{width:min(var(--chat-transfer-width-v49,260px),430px)!important;max-width:min(var(--chat-transfer-width-v49,260px),430px)!important}.transfer-card-v41 header{padding:16px 21px 6px;gap:13px}.transfer-card-v41 header i{width:45px;height:45px}.transfer-card-v41 header svg{width:28px;height:28px}.transfer-card-v41 header strong{font-size:33px}.transfer-card-v41 p{margin:8px 21px 13px;padding-left:58px}.transfer-card-v41.transfer-receipt-v47 footer{padding:10px 21px;border-top:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.84);font-size:13px}</style>')}
window.addEventListener('resize',()=>applyTransferWidthV49(current?.appearance?.transferCardWidth));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectTransferRefinementV49();hydrateTransferWidthV49();renderToolManagerV17?.()});else{injectTransferRefinementV49();hydrateTransferWidthV49();renderToolManagerV17?.()}

/* V50: tighter payment-card rhythm and a clear success mark on receipts. */
const TRANSFER_RECEIVED_ICON_V50='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7.4"/></svg>';
function transferCardV50(message){const item=message.transfer||{},outgoing=item.from==='iris',receipt=!!item.receipt,received=receipt&&item.status==='received',icon=received?TRANSFER_RECEIVED_ICON_V50:TRANSFER_ARROWS_ICON_V41;return '<article class="transfer-card-v41 '+(outgoing?'outgoing':'incoming')+(receipt?' transfer-receipt-v47':'')+'" data-transfer-message-id="'+esc(String(message.id||''))+'" data-transfer-open-v45="'+(!outgoing&&!receipt?'true':'false')+'"><header><i>'+icon+'</i><strong>'+transferMoneyV40(item.amount)+'</strong></header>'+(receipt?'':'<p>'+esc(item.note||'给你的小心意')+'</p>')+'<footer>'+transferStatusLabelV47(item)+'</footer></article>'}
transferCardV41=transferCardV50;
function injectTransferCompactV50(){if($('transferCompactV50'))return;document.head.insertAdjacentHTML('beforeend','<style id="transferCompactV50">.transfer-card-v41 header{padding:10px 21px 0}.transfer-card-v41 header i{transform:translateY(8px)}.transfer-card-v41 p{margin:1px 21px 8px;padding-left:58px}.transfer-card-v41 footer{padding:9px 21px}.transfer-card-v41.transfer-receipt-v47 header{padding-bottom:4px}.transfer-card-v41.transfer-receipt-v47 header i{transform:translateY(5px)}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectTransferCompactV50);else injectTransferCompactV50();

/* V51: invitation cards live in the ordinary left/right message flow, while
   completion cards deliberately keep their centred record presentation. */
const COMPANION_CARD_DEFAULT_COLOR_V51='#DDF0EF';
const companionInvitationSessionsV83=new Map();
const COMPANION_ENDED_ICON_V83='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8.8 12.2 11 14.4l4.5-4.8"/></svg>';
async function refreshCompanionInvitationSessionsV83(){try{const data=await api('/api/companion/sessions');companionInvitationSessionsV83.clear();(data.sessions||[]).forEach(session=>{if(session?.id)companionInvitationSessionsV83.set(session.id,session)});if(typeof renderMessages==='function')renderMessages()}catch(_){}}
function companionCardWidthV51(value){return roomNumberV16(value,55,100,84)}
function applyCompanionCardWidthV51(value){const percent=companionCardWidthV51(value),available=Math.max(190,window.innerWidth-100);document.documentElement.style.setProperty('--chat-companion-card-width-v51',Math.round(available*percent/100)+'px');const label=$('companionCardWidthValueV51');if(label)label.textContent=percent+'%'}
function companionInvitationCardV51(message){const item=message.companionInvitation||{},outgoing=item.from==='iris',status=item.status||'pending',room=item.sessionId?companionInvitationSessionsV83.get(item.sessionId):null,ended=room?.status==='ended'||item.roomStatus==='ended',activity=esc(companionActivityNameV35(item)),name=esc(companionRoleNameV34()),headline=outgoing?'我邀请 '+name+' 一起'+activity:name+' 想邀请你一起'+activity;let action='';if(status==='pending'&&outgoing)action='<span class="companion-card-status-v51">等待回复</span>';else if(status==='pending')action='<div class="companion-card-actions-v51"><button type="button" data-companion-invitation-accept="'+esc(String(message.id||''))+'">同意</button><button type="button" class="quiet" data-companion-invitation-decline="'+esc(String(message.id||''))+'">拒绝</button></div>';else if(status==='accepted'&&ended)action='<span class="companion-card-status-v51 companion-card-ended-v83">'+COMPANION_ENDED_ICON_V83+'已结束</span>';else if(status==='accepted')action='<div class="companion-card-actions-v51"><span class="companion-card-status-v51">已同意</span><button type="button" data-companion-invitation-enter="'+esc(String(message.id||''))+'">进入陪伴房间</button></div>';else action='<span class="companion-card-status-v51">已拒绝</span>';return '<article class="companion-invitation-v51"><header><i>'+companionSceneIconV35(item.scene)+'</i><span>COMPANION · 邀请</span></header><strong>'+headline+'</strong>'+action+'</article>'}
function renderCompanionInvitationV51(group,role){const message=group.messages[0],user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(message.createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',card='<div class="bubble-stack companion-card-stack-v51">'+companionInvitationCardV51(message)+'</div>';return '<div class="message-group companion-invitation-message-v51 '+(user?'user':'assistant')+'">'+(user?card+person:person+card)+'</div>'}
const renderGroupV51Base=renderGroup;renderGroup=function(group,role){const first=group?.messages?.[0];return first?.companionInvitation?renderCompanionInvitationV51(group,role):renderGroupV51Base(group,role)};
function persistCompanionAppearanceV51(key,value){if(!current)return Promise.resolve();const appearance={...(current.appearance||{}),[key]:value};return updateConversation(current.id,{appearance}).then(()=>{current.appearance=appearance;applyAppearance();toast('陪伴邀请卡设置已保存','success')}).catch(error=>toast('保存设置失败：'+error.message,'error'))}
function ensureCompanionCardControlsV51(){const panel=$('rightMenuPanel-beauty'),anchor=$('transferCardWidthRowV49')||$('transferCardColorRowV44');if(!panel||!anchor)return;if(!$('companionCardColorV51'))anchor.insertAdjacentHTML('afterend','<label class="setting-row" id="companionCardColorRowV51"><span>邀请卡片</span><input id="companionCardColorV51" type="color" aria-label="邀请卡片颜色"><input class="colour-code-input" id="companionCardColorCodeV51" type="text" maxlength="7" autocomplete="off" placeholder="DDF0EF" aria-label="邀请卡片颜色代码"></label>');const color=$('companionCardColorV51'),code=$('companionCardColorCodeV51');if(color){const sync=()=>{const hex=transferHexV45(color.value);color.value=hex;code.value=hex.slice(1);document.documentElement.style.setProperty('--chat-companion-card-color',hex)};color.oninput=sync;color.onchange=()=>persistCompanionAppearanceV51('companionCardColor',color.value);code.onchange=()=>{color.value=transferHexV45(code.value,color.value);sync();persistCompanionAppearanceV51('companionCardColor',color.value)};color.value=roomHexV14(current?.appearance?.companionCardColor,COMPANION_CARD_DEFAULT_COLOR_V51);sync()}const colorRow=$('companionCardColorRowV51');if(colorRow&&!$('companionCardWidthV51'))colorRow.insertAdjacentHTML('afterend','<label class="setting-row" id="companionCardWidthRowV51"><span>邀请卡片宽度<small id="companionCardWidthValueV51"></small></span><input id="companionCardWidthV51" type="range" min="55" max="100" step="1"></label>');const width=$('companionCardWidthV51');if(width){width.value=companionCardWidthV51(current?.appearance?.companionCardWidth);width.oninput=()=>applyCompanionCardWidthV51(width.value);width.onchange=()=>persistCompanionAppearanceV51('companionCardWidth',companionCardWidthV51(width.value));applyCompanionCardWidthV51(width.value)}}
const hydrateRightV51Base=hydrateRight;hydrateRight=function(){hydrateRightV51Base();ensureCompanionCardControlsV51()};
const applyAppearanceV51Base=applyAppearance;applyAppearance=function(){applyAppearanceV51Base();const a=current?.appearance||{};document.documentElement.style.setProperty('--chat-companion-card-color',roomHexV14(a.companionCardColor,COMPANION_CARD_DEFAULT_COLOR_V51));applyCompanionCardWidthV51(a.companionCardWidth)};
function injectCompanionCardFlowV51(){if($('companionCardFlowV51'))return;document.head.insertAdjacentHTML('beforeend','<style id="companionCardFlowV51">.transfer-card-v41 p{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.transfer-card-v41.transfer-receipt-v47 header i{transform:translateY(1px)}.companion-card-stack-v51{width:min(var(--chat-companion-card-width-v51,260px),430px)!important;max-width:min(var(--chat-companion-card-width-v51,260px),430px)!important}.companion-invitation-v51{width:100%;box-sizing:border-box;overflow:hidden;padding:15px 17px 13px;border:1px solid color-mix(in srgb,var(--chat-companion-card-color,'+COMPANION_CARD_DEFAULT_COLOR_V51+') 75%,#8ba9a6);border-radius:16px;background:var(--chat-companion-card-color,'+COMPANION_CARD_DEFAULT_COLOR_V51+');color:var(--chat-text);box-shadow:var(--shadow-xs)}.companion-invitation-v51 header{display:flex;align-items:center;gap:9px;color:var(--chat-muted)}.companion-invitation-v51 header i{display:grid;place-items:center;width:25px;height:25px;color:var(--chat-accent)}.companion-invitation-v51 header svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.companion-invitation-v51 header span{font:11px var(--font-b);letter-spacing:.08em}.companion-invitation-v51 strong{display:block;margin:9px 0 0;font:400 18px/1.35 var(--font-d)}.companion-card-status-v51{display:block;margin-top:10px;padding-top:9px;border-top:1px solid color-mix(in srgb,var(--chat-text) 13%,transparent);color:var(--chat-muted);font:12px var(--font-b)}.companion-card-actions-v51{display:flex;gap:8px;margin-top:12px}.companion-card-actions-v51 button{flex:1;padding:8px;border:0;border-radius:9px;background:var(--chat-accent);color:var(--accent-contrast);font:13px var(--font-b);cursor:pointer}.companion-card-actions-v51 button.quiet{border:1px solid color-mix(in srgb,var(--chat-text) 18%,transparent);background:transparent;color:var(--chat-text)}.companion-card-actions-v51 .companion-card-status-v51{flex:1;margin:0;padding:8px 4px;border:0;text-align:center}.companion-card-ended-v83{display:flex;align-items:center;gap:6px}.companion-card-ended-v83 svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}#companionCardColorRowV51{gap:10px}#companionCardColorRowV51 .colour-code-input{width:112px;min-width:0;text-transform:uppercase}</style>')}
window.addEventListener('resize',()=>applyCompanionCardWidthV51(current?.appearance?.companionCardWidth));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectCompanionCardFlowV51();ensureCompanionCardControlsV51();applyAppearance();refreshCompanionInvitationSessionsV83()});else{injectCompanionCardFlowV51();ensureCompanionCardControlsV51();applyAppearance();refreshCompanionInvitationSessionsV83()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCompanionInvitationSessionsV83()});

/* V52: transfer status notices are system events, not recalled messages. */
const systemMessageLabelV52Base=systemMessageLabelV30;
systemMessageLabelV30=function(message){if(message?.systemType==='transfer_response')return String(message.content||'转账状态已更新');return systemMessageLabelV52Base(message)};

/* V53: keep invitation appearance controls with the other colour controls. */
function placeCompanionControlsInBeautyV53(){const panel=$('rightMenuPanel-beauty'),anchor=$('transferCardColorRowV44');if(!panel||!anchor)return;const colorRow=$('companionCardColorRowV51'),widthRow=$('companionCardWidthRowV51');if(colorRow)anchor.insertAdjacentElement('afterend',colorRow);if(widthRow)(colorRow||anchor).insertAdjacentElement('afterend',widthRow)}
const hydrateRightV53Base=hydrateRight;hydrateRight=function(){hydrateRightV53Base();placeCompanionControlsInBeautyV53()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',placeCompanionControlsInBeautyV53);else placeCompanionControlsInBeautyV53();

/* V54: transfer receipts are the visible status; keep their system event out
   of the transcript while retaining it in stored context for the model. */
const groupMessagesV54Base=groupMessages;
groupMessages=function(list){return groupMessagesV54Base(list).filter(group=>group?.messages?.[0]?.systemType!=='transfer_response')};

/* V55: sticker library, picker, role palette controls and compact sticker
   messages. Sticker IDs are persisted, while the browser only renders the
   server-provided snapshot URL. */
let stickerLibraryV55={packs:[],stickers:[]},stickerPackV55='all',stickerQuickFileV55=null;
function stickerEscV55(value){return esc(String(value??''))}
async function loadStickerLibraryV55(){const data=await api('/api/chat/stickers');stickerLibraryV55={packs:Array.isArray(data?.packs)?data.packs:[],stickers:Array.isArray(data?.stickers)?data.stickers:[]};return stickerLibraryV55}
function stickerRoleV55(){return roles.find(role=>role.id===current?.roleId)||null}
function stickerRoleConfigV55(){const saved=stickerRoleV55()?.stickerConfig||{};return {enabled:saved.enabled===true,allPacks:saved.allPacks===true,packIds:Array.isArray(saved.packIds)?saved.packIds:[],perPackLimit:Math.max(1,Math.min(20,Number(saved.perPackLimit)||8)),totalLimit:Math.max(4,Math.min(80,Number(saved.totalLimit)||32)),refreshEvery:Math.max(1,Math.min(30,Number(saved.refreshEvery)||8)),signatureIds:Array.isArray(saved.signatureIds)?saved.signatureIds:[],favoriteIds:Array.isArray(saved.favoriteIds)?saved.favoriteIds:[]}}
function injectStickerV55Styles(){if($('stickerV55Styles'))return;document.head.insertAdjacentHTML('beforeend','<style id="stickerV55Styles">.transfer-add-grid-v41{grid-template-columns:repeat(4,1fr)}.sticker-add-icon-v55{font:400 29px var(--font-d)!important}.sticker-picker-v55{position:fixed;z-index:165;inset:0;visibility:hidden;pointer-events:none}.sticker-picker-v55.open{visibility:visible;pointer-events:auto}.sticker-picker-v55 .backdrop{position:absolute;inset:0;background:rgba(35,31,32,.18);opacity:0;transition:opacity .18s}.sticker-picker-v55.open .backdrop{opacity:1}.sticker-picker-panel-v55{position:absolute;right:0;bottom:0;left:0;max-height:min(62dvh,540px);padding:10px 15px calc(17px + env(safe-area-inset-bottom));overflow:auto;border-radius:26px 26px 0 0;background:var(--chat-surface);box-shadow:0 -12px 32px rgba(42,34,30,.14);transform:translateY(105%);transition:transform .22s ease}.sticker-picker-v55.open .sticker-picker-panel-v55{transform:none}.sticker-picker-grab-v55{width:38px;height:4px;margin:0 auto 11px;border-radius:99px;background:var(--chat-border)}.sticker-picker-head-v55{display:flex;align-items:center;justify-content:space-between;margin:0 3px 11px}.sticker-picker-head-v55 h2{margin:0;font:400 22px var(--font-d);color:var(--chat-text)}.sticker-picker-head-v55 button{border:0;background:transparent;color:var(--chat-muted);font:13px var(--font-b);cursor:pointer}.sticker-pack-row-v55{display:flex;gap:7px;margin:0 -2px 12px;padding:2px;overflow:auto;scrollbar-width:none}.sticker-pack-row-v55::-webkit-scrollbar{display:none}.sticker-pack-chip-v55{flex:none;padding:7px 11px;border:1px solid var(--chat-border);border-radius:999px;background:var(--chat-bg);color:var(--chat-muted);font:12px var(--font-b);white-space:nowrap;cursor:pointer}.sticker-pack-chip-v55.active{border-color:var(--chat-accent);background:var(--chat-accent);color:var(--accent-contrast)}.sticker-grid-v55{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.sticker-grid-v55 button{position:relative;aspect-ratio:1;min-width:0;padding:0;overflow:hidden;border:1px solid var(--chat-border);border-radius:13px;background:var(--chat-surface);box-shadow:var(--shadow-xs);cursor:pointer}.sticker-grid-v55 button:active{transform:scale(.96)}.sticker-grid-v55 img{width:100%;height:100%;object-fit:cover}.sticker-grid-v55 .upload{display:grid;place-items:center;border-style:dashed;background:color-mix(in srgb,var(--chat-surface) 72%,var(--accent-pale));color:var(--chat-accent);font:300 28px var(--font-d)}.sticker-grid-v55 .empty{grid-column:1/-1;padding:22px;color:var(--chat-muted);font:12px var(--font-b);text-align:center}.chat-sticker-v55{display:block;width:min(108px,32vw);padding:0;overflow:hidden;border:0;border-radius:12px;background:transparent;box-shadow:var(--shadow-xs);cursor:pointer}.chat-sticker-v55 img{display:block;width:100%;max-height:118px;object-fit:contain;background:var(--chat-surface)}.user .chat-sticker-v55{margin-left:auto}.sticker-quick-v55{position:fixed;z-index:720;inset:0;display:none;align-items:flex-end;background:rgba(36,31,30,.28);backdrop-filter:blur(5px)}.sticker-quick-v55.open{display:flex}.sticker-quick-panel-v55{width:100%;padding:10px 20px calc(20px + env(safe-area-inset-bottom));border-radius:27px 27px 0 0;background:var(--chat-surface);box-shadow:0 -12px 38px rgba(42,34,30,.16)}.sticker-quick-panel-v55 h2{margin:7px 0 15px;text-align:center;font:400 23px var(--font-d)}.sticker-quick-form-v55{display:grid;grid-template-columns:74px 1fr;gap:11px}.sticker-quick-form-v55 img{width:74px;height:74px;object-fit:cover;border:1px solid var(--chat-border);border-radius:13px}.sticker-quick-form-v55 label{display:grid;gap:5px;color:var(--chat-muted);font:12px var(--font-b)}.sticker-quick-form-v55 select,.sticker-quick-form-v55 textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--chat-border);border-radius:10px;background:var(--chat-bg);color:var(--chat-text);font:13px var(--font-b)}.sticker-quick-form-v55 textarea{min-height:64px;resize:none}.sticker-quick-actions-v55{display:flex;gap:8px;margin-top:15px}.sticker-quick-actions-v55 button{flex:1;padding:12px;border:0;border-radius:12px;background:var(--chat-accent);color:var(--accent-contrast);font:14px var(--font-b);cursor:pointer}.sticker-quick-actions-v55 .quiet{background:var(--chat-bg);color:var(--chat-muted);border:1px solid var(--chat-border)}.sticker-role-settings-v55 .setting-row{align-items:center}.sticker-role-settings-v55 .setting-row small{display:block;margin-top:3px;color:var(--chat-muted);font-size:10px}.sticker-role-settings-v55 .sticker-role-packs-v55{display:grid;gap:5px;margin:6px 0 2px}.sticker-role-settings-v55 .pack-toggle-v55{display:flex;align-items:center;gap:8px;padding:7px 0;color:var(--chat-muted);font:12px var(--font-b)}.sticker-role-settings-v55 .pack-toggle-v55 input{accent-color:var(--chat-accent)}@media(max-width:380px){.sticker-grid-v55{gap:6px}.sticker-picker-panel-v55{padding-inline:11px}}</style>')}
function ensureStickerPickerV55(){if($('stickerPickerV55'))return;document.body.insertAdjacentHTML('beforeend','<section class="sticker-picker-v55" id="stickerPickerV55" aria-hidden="true"><button type="button" class="backdrop" data-sticker-close aria-label="关闭"></button><div class="sticker-picker-panel-v55"><div class="sticker-picker-grab-v55"></div><header class="sticker-picker-head-v55"><h2>表情包</h2><button type="button" id="stickerLibraryLinkV55">管理表情包</button></header><div class="sticker-pack-row-v55" id="stickerPackRowV55"></div><div class="sticker-grid-v55" id="stickerGridV55"></div></div></section><input type="file" id="stickerQuickInputV55" accept="image/png,image/jpeg,image/webp,image/gif" hidden><section class="sticker-quick-v55" id="stickerQuickV55" aria-hidden="true"><div class="sticker-quick-panel-v55"><h2>发送新表情</h2><div class="sticker-quick-form-v55"><img id="stickerQuickPreviewV55" alt="表情包预览"><div><label>所属包<select id="stickerQuickPackV55"></select></label><label style="margin-top:9px">描述（可选）<textarea id="stickerQuickDescriptionV55" maxlength="240" placeholder="例如：委屈地等你抱抱的小狗"></textarea></label></div></div><div class="sticker-quick-actions-v55"><button type="button" class="quiet" data-sticker-quick-close>取消</button><button type="button" id="stickerQuickSendV55">保存并发送</button></div></div></section>');const picker=$('stickerPickerV55'),close=()=>{picker.classList.remove('open');picker.setAttribute('aria-hidden','true');document.body.classList.remove('chat-add-open-v41')};picker.querySelector('[data-sticker-close]').onclick=close;$('stickerLibraryLinkV55').onclick=()=>location.href='stickers.html';$('stickerQuickInputV55').onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>5*1024*1024)return toast('表情包图片需小于 5MB','error');stickerQuickFileV55=file;const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file)}).catch(error=>{toast(error.message,'error');return ''});if(!data)return;stickerQuickFileV55={file,data};$('stickerQuickPreviewV55').src=data;$('stickerQuickPackV55').innerHTML='<option value="">未分类</option>'+stickerLibraryV55.packs.map(pack=>'<option value="'+stickerEscV55(pack.id)+'">'+stickerEscV55(pack.name)+'</option>').join('');$('stickerQuickPackV55').value=stickerPackV55==='all'||stickerPackV55==='none'?'':stickerPackV55;$('stickerQuickDescriptionV55').value='';$('stickerQuickV55').classList.add('open');$('stickerQuickV55').setAttribute('aria-hidden','false')};document.querySelectorAll('[data-sticker-quick-close]').forEach(button=>button.onclick=()=>{$('stickerQuickV55').classList.remove('open');$('stickerQuickV55').setAttribute('aria-hidden','true');stickerQuickFileV55=null});$('stickerQuickV55').onclick=event=>{if(event.target===$('stickerQuickV55')){$('stickerQuickV55').classList.remove('open');stickerQuickFileV55=null}};$('stickerQuickSendV55').onclick=sendQuickStickerV55}
function renderStickerPickerV55(){const library=stickerLibraryV55,packs=[['all','全部'],['none','未分类'],...library.packs.map(pack=>[pack.id,pack.name])],row=$('stickerPackRowV55'),grid=$('stickerGridV55');if(!row||!grid)return;row.innerHTML=packs.map(([id,name])=>'<button class="sticker-pack-chip-v55 '+(stickerPackV55===id?'active':'')+'" data-sticker-pack="'+stickerEscV55(id)+'">'+stickerEscV55(name)+'</button>').join('');row.querySelectorAll('[data-sticker-pack]').forEach(button=>button.onclick=()=>{stickerPackV55=button.dataset.stickerPack;renderStickerPickerV55()});const list=library.stickers.filter(item=>stickerPackV55==='all'||(stickerPackV55==='none'?!item.packId:item.packId===stickerPackV55));grid.innerHTML='<button type="button" class="upload" id="stickerQuickUploadV55" aria-label="上传并发送表情">＋</button>'+list.map(item=>'<button type="button" data-send-sticker="'+stickerEscV55(item.id)+'" aria-label="发送 '+stickerEscV55(item.name||'表情包')+'"><img src="'+stickerEscV55(item.imageUrl)+'" alt="'+stickerEscV55(item.name||'表情包')+'"></button>').join('')+(list.length?'':'<p class="empty">还没有表情包，先上传一张吧。</p>');$('stickerQuickUploadV55').onclick=()=>$('stickerQuickInputV55').click();grid.querySelectorAll('[data-send-sticker]').forEach(button=>button.onclick=()=>sendStickerV55(button.dataset.sendSticker))}
async function openStickerPickerV55(){if(!current)return toast('请先选择角色开始聊天','error');ensureStickerPickerV55();try{await loadStickerLibraryV55();renderStickerPickerV55();const picker=$('stickerPickerV55');picker.classList.add('open');picker.setAttribute('aria-hidden','false');document.body.classList.remove('chat-add-open-v41')}catch(error){toast(error.message||'表情包库加载失败','error')}}
async function sendStickerV55(stickerId){if(savingBubble||!current)return;const sticker=stickerLibraryV55.stickers.find(item=>item.id===stickerId);if(!sticker)return toast('表情包已不存在，请刷新','error');savingBubble=true;$('sendBtn').disabled=true;const groupId=pendingTurnGroupId||'turn-'+Date.now(),tempId='temp-sticker-'+Date.now(),content='【表情包】'+[sticker.name,...(sticker.tags||[]),sticker.description].filter(Boolean).join('、');pendingTurnGroupId=groupId;const temp={id:tempId,replyGroupId:groupId,conversationId:current.id,role:'iris',content,sticker:{id:sticker.id,name:sticker.name,description:sticker.description,tags:sticker.tags,imageUrl:sticker.imageUrl},createdAt:new Date().toISOString()};messages.push(temp);const picker=$('stickerPickerV55');if(picker){picker.classList.remove('open');picker.setAttribute('aria-hidden','true')}renderMessages();scrollBottom();try{const saved=await api('/api/chat/messages',{method:'POST',body:JSON.stringify({conversationId:current.id,stickerId,replyGroupId:groupId})});const index=messages.findIndex(message=>message.id===tempId);if(index>=0)messages[index]=saved;await refreshConversationMeta();renderMessages()}catch(error){messages=messages.filter(message=>message.id!==tempId);if(!messages.some(message=>message.role==='iris'&&message.replyGroupId===groupId))pendingTurnGroupId='';renderMessages();toast('发送失败：'+error.message,'error')}finally{savingBubble=false;$('sendBtn').disabled=false;updateReplyButton();scrollBottom()}}
async function sendQuickStickerV55(){const item=stickerQuickFileV55;if(!item?.data)return;const button=$('stickerQuickSendV55');button.disabled=true;button.textContent='上传中…';try{const saved=await api('/api/chat/stickers',{method:'POST',body:JSON.stringify({dataUrl:item.data,name:item.file?.name?.replace(/\.[^.]+$/,'')||'',packId:$('stickerQuickPackV55').value||null,description:$('stickerQuickDescriptionV55').value.trim()})});stickerLibraryV55.stickers.push(saved);$('stickerQuickV55').classList.remove('open');$('stickerQuickV55').setAttribute('aria-hidden','true');stickerQuickFileV55=null;await sendStickerV55(saved.id)}catch(error){toast(error.message||'上传失败','error')}finally{button.disabled=false;button.textContent='保存并发送'}}
const messageContentV55Base=messageContent;messageContent=function(message){if(!message?.sticker)return messageContentV55Base(message);const item=message.sticker;const id=stickerEscV55(message.id||'');if(message.recalled)return messageContentV55Base(message);return '<article class="chat-message-item sticker-message-v55" data-message-id="'+id+'"><button type="button" class="chat-sticker-v55" title="'+stickerEscV55(item.name||'表情包')+'"><img src="'+stickerEscV55(item.imageUrl)+'" alt="'+stickerEscV55(item.name||item.description||'表情包')+'"></button></article>'};
const ensureTransferAddMenuV55Base=ensureTransferAddMenuV41;ensureTransferAddMenuV41=function(){const menu=ensureTransferAddMenuV55Base();if(!menu.querySelector('[data-add-sticker]')){const grid=menu.querySelector('.transfer-add-grid-v41');grid.insertAdjacentHTML('beforeend','<button type="button" data-add-sticker><i class="sticker-add-icon-v55">☺</i><span>表情包</span></button>');menu.querySelector('[data-add-sticker]').onclick=()=>openStickerPickerV55()}return menu};
function ensureStickerRoleSettingsV55(){const drawer=$('rightDrawer')?.querySelector('.drawer-scroll'),role=stickerRoleV55();if(!drawer||!role)return;let block=$('stickerRoleSettingsV55');if(!block){drawer.insertAdjacentHTML('beforeend','<div class="setting-block sticker-role-settings-v55" id="stickerRoleSettingsV55"><h3>表情包</h3><label class="setting-row"><span>允许 TA 发表情包<small>关闭时不会注入给 TA</small></span><input class="switch" id="stickerEnabledV55" type="checkbox"></label><label class="setting-row"><span>全部包可用</span><input class="switch" id="stickerAllPacksV55" type="checkbox"></label><label class="setting-row"><span>每包注入数量</span><input id="stickerPerPackV55" type="range" min="1" max="20"></label><label class="setting-row"><span>总注入上限</span><input id="stickerTotalV55" type="range" min="4" max="80" step="4"></label><label class="setting-row"><span>每几轮刷新</span><input id="stickerRefreshV55" type="range" min="1" max="30"></label><div class="sticker-role-packs-v55" id="stickerRolePacksV55"></div></div>');block=$('stickerRoleSettingsV55');const save=async()=>{const config=stickerRoleConfigV55();config.enabled=$('stickerEnabledV55').checked;config.allPacks=$('stickerAllPacksV55').checked;config.perPackLimit=+$('stickerPerPackV55').value;config.totalLimit=+$('stickerTotalV55').value;config.refreshEvery=+$('stickerRefreshV55').value;config.packIds=Array.from(document.querySelectorAll('[data-role-sticker-pack]:checked')).map(input=>input.value);try{const saved=await api('/api/chat/roles/'+encodeURIComponent(role.id),{method:'PUT',body:JSON.stringify({stickerConfig:config})});roles=roles.map(item=>item.id===saved.id?saved:item);toast('表情包设置已保存','success');hydrateStickerRoleSettingsV55()}catch(error){toast(error.message||'设置保存失败','error')}};['stickerEnabledV55','stickerAllPacksV55','stickerPerPackV55','stickerTotalV55','stickerRefreshV55'].forEach(id=>$(id).onchange=save);$('stickerRolePacksV55').onchange=save}hydrateStickerRoleSettingsV55()}
function hydrateStickerRoleSettingsV55(){const role=stickerRoleV55(),block=$('stickerRoleSettingsV55');if(!role||!block)return;const config=stickerRoleConfigV55();$('stickerEnabledV55').checked=config.enabled;$('stickerAllPacksV55').checked=config.allPacks;$('stickerPerPackV55').value=config.perPackLimit;$('stickerTotalV55').value=config.totalLimit;$('stickerRefreshV55').value=config.refreshEvery;$('stickerRolePacksV55').innerHTML=stickerLibraryV55.packs.length?stickerLibraryV55.packs.map(pack=>'<label class="pack-toggle-v55"><input type="checkbox" value="'+stickerEscV55(pack.id)+'" data-role-sticker-pack '+(config.allPacks||config.packIds.includes(pack.id)?'checked':'')+'> '+stickerEscV55(pack.name)+'</label>').join(''):'<p class="empty-note">先去“更多 → 表情包库”创建一个包。</p>';block.querySelectorAll('input:not(#stickerEnabledV55)').forEach(input=>input.disabled=!config.enabled);}
const hydrateRightV55Base=hydrateRight;hydrateRight=function(){hydrateRightV55Base();ensureStickerRoleSettingsV55()};
async function initStickersV55(){injectStickerV55Styles();try{await loadStickerLibraryV55()}catch(error){console.warn('sticker library init failed:',error.message)}ensureStickerPickerV55();ensureStickerRoleSettingsV55();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initStickersV55);else initStickersV55();

/* V56: wire stickers into the current menu implementations.  The previous
   drawer hook targeted the retired settings DOM, so keep this small layer
   beside the current accordion menu instead. */
ensureStickerRoleSettingsV55=function(){};
function stickerFaceIconV56(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r=".8"/><circle cx="15" cy="10" r=".8"/><path d="M8.5 14.2c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5"/></svg>'}
function injectStickerV56Styles(){if($('stickerV56Styles'))return;document.head.insertAdjacentHTML('beforeend','<style id="stickerV56Styles">.transfer-add-grid-v41 .sticker-add-icon-v56{border-radius:50%!important}.sticker-add-icon-v56 svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}.sticker-settings-v56 .sticker-setting-note{margin:0 0 9px;color:var(--chat-muted);font:11px/1.45 var(--font-b)}.sticker-settings-v56 .sticker-setting-label{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:9px 0 3px;color:var(--chat-muted);font:12px var(--font-b)}.sticker-settings-v56 .sticker-setting-label output{color:var(--chat-text);font-variant-numeric:tabular-nums}.sticker-settings-v56 input[type=range]{width:100%;accent-color:var(--chat-accent)}.sticker-settings-v56 .sticker-role-packs-v56{display:grid;gap:2px;margin-top:9px;padding-top:8px;border-top:1px dashed var(--chat-border)}.sticker-settings-v56 .pack-toggle-v56{display:flex;align-items:center;gap:8px;min-height:31px;color:var(--chat-muted);font:12px var(--font-b)}.sticker-settings-v56 .pack-toggle-v56 input{accent-color:var(--chat-accent)}</style>')}
const ensureTransferAddMenuV56Base=ensureTransferAddMenuV41;ensureTransferAddMenuV41=function(){const menu=ensureTransferAddMenuV56Base();const button=menu?.querySelector('[data-add-sticker]');if(button){button.innerHTML='<i class="sticker-add-icon-v56">'+stickerFaceIconV56()+'</i><span>表情包</span>';button.onclick=()=>openStickerPickerV55()}return menu};
function stickerConfigPanelV56(){const panel=$('rightMenuPanel-stickersV56'),role=stickerRoleV55();if(!panel)return;if(!role){panel.innerHTML='<p class="empty-note">请先选择一个角色卡。</p>';return}const config=stickerRoleConfigV55(),packs=stickerLibraryV55.packs||[];panel.innerHTML='<div class="setting-block sticker-role-settings-v55 sticker-settings-v56"><p class="sticker-setting-note">仅向当前角色注入。关闭后 TA 不会使用表情包。</p><label class="setting-row"><span>允许 TA 发表情包</span><input class="switch" id="stickerEnabledV56" type="checkbox" '+(config.enabled?'checked':'')+'></label><label class="setting-row"><span>全部包可用</span><input class="switch" id="stickerAllPacksV56" type="checkbox" '+(config.allPacks?'checked':'')+'></label><label class="sticker-setting-label"><span>每包注入数量</span><output id="stickerPerPackOutputV56">'+config.perPackLimit+' 张</output></label><input id="stickerPerPackV56" type="range" min="1" max="20" value="'+config.perPackLimit+'"><label class="sticker-setting-label"><span>总注入上限</span><output id="stickerTotalOutputV56">'+config.totalLimit+' 张</output></label><input id="stickerTotalV56" type="range" min="4" max="80" step="4" value="'+config.totalLimit+'"><label class="sticker-setting-label"><span>每几轮重新抽取</span><output id="stickerRefreshOutputV56">'+config.refreshEvery+' 轮</output></label><input id="stickerRefreshV56" type="range" min="1" max="30" value="'+config.refreshEvery+'"><div class="sticker-role-packs-v56" id="stickerRolePacksV56">'+(packs.length?packs.map(pack=>'<label class="pack-toggle-v56"><input type="checkbox" value="'+stickerEscV55(pack.id)+'" data-sticker-role-pack-v56 '+(config.allPacks||config.packIds.includes(pack.id)?'checked':'')+'> '+stickerEscV55(pack.name)+'</label>').join(''):'<p class="empty-note">还没有表情包包，先去“更多 → 表情包库”创建。</p>')+'</div></div>';const fields=['stickerAllPacksV56','stickerPerPackV56','stickerTotalV56','stickerRefreshV56'];const setAvailability=()=>{const on=$('stickerEnabledV56').checked;fields.forEach(id=>$(id).disabled=!on);panel.querySelectorAll('[data-sticker-role-pack-v56]').forEach(input=>input.disabled=!on);$('stickerPerPackOutputV56').textContent=$('stickerPerPackV56').value+' 张';$('stickerTotalOutputV56').textContent=$('stickerTotalV56').value+' 张';$('stickerRefreshOutputV56').textContent=$('stickerRefreshV56').value+' 轮'};const save=async()=>{const next=stickerRoleConfigV55();next.enabled=$('stickerEnabledV56').checked;next.allPacks=$('stickerAllPacksV56').checked;next.perPackLimit=+$('stickerPerPackV56').value;next.totalLimit=+$('stickerTotalV56').value;next.refreshEvery=+$('stickerRefreshV56').value;next.packIds=Array.from(panel.querySelectorAll('[data-sticker-role-pack-v56]:checked')).map(input=>input.value);setAvailability();try{const saved=await api('/api/chat/roles/'+encodeURIComponent(role.id),{method:'PUT',body:JSON.stringify({stickerConfig:next})});roles=roles.map(item=>item.id===saved.id?saved:item);toast('表情包设置已保存','success')}catch(error){toast(error.message||'设置保存失败','error')}};$('stickerEnabledV56').onchange=save;$('stickerAllPacksV56').onchange=save;['stickerPerPackV56','stickerTotalV56','stickerRefreshV56'].forEach(id=>$(id).oninput=setAvailability);['stickerPerPackV56','stickerTotalV56','stickerRefreshV56'].forEach(id=>$(id).onchange=save);$('stickerRolePacksV56').onchange=save;setAvailability()}
function ensureStickerRoleSettingsV56(){const root=$('rightSettingsMenuV12');if(!root)return;let section=$('stickerRoleSettingsSectionV56');if(!section){section=document.createElement('section');section.id='stickerRoleSettingsSectionV56';section.className='right-menu-section';section.dataset.rightSection='stickersV56';section.innerHTML='<button type="button" class="right-menu-summary" aria-expanded="false" data-sticker-settings-toggle-v56><span class="right-menu-icon">'+stickerFaceIconV56()+'</span><span>表情包</span><svg class="right-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button><div class="right-menu-panel" id="rightMenuPanel-stickersV56"></div>';const storage=root.querySelector('[data-right-section="storage"]');root.insertBefore(section,storage||null);section.querySelector('[data-sticker-settings-toggle-v56]').onclick=function(){const open=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!open));if(!open)stickerConfigPanelV56()}}}
const hydrateRightV56Base=hydrateRight;hydrateRight=function(){hydrateRightV56Base();ensureStickerRoleSettingsV56()};
function initStickersV56(){injectStickerV56Styles();ensureTransferAddMenuV41();ensureStickerRoleSettingsV56()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initStickersV56);else initStickersV56();

/* V57: the sticker browser belongs inside the existing attachment tray.  It
   also patches the V6 renderer, which deliberately calls its formatter by
   name and therefore bypassed the earlier sticker formatter. */
const messageContentV57Base=messageContentV6;messageContentV6=function(message,index){if(!message?.sticker)return messageContentV57Base(message,index);const item=message.sticker,id=stickerEscV55(message.id||'');return '<article class="chat-message-item sticker-message-v55" data-message-id="'+id+'"><button type="button" class="chat-sticker-v55" title="'+stickerEscV55(item.name||'表情包')+'"><img src="'+stickerEscV55(item.imageUrl)+'" alt="'+stickerEscV55(item.name||item.description||'表情包')+'"></button></article>'};
function injectStickerTrayV57Styles(){if($('stickerTrayV57Styles'))return;document.head.insertAdjacentHTML('beforeend','<style id="stickerTrayV57Styles">.transfer-add-grid-v41[hidden],.sticker-tray-v57[hidden]{display:none!important}.transfer-add-menu-v41.sticker-browse-v57 .transfer-add-panel-v41{min-height:var(--chat-add-panel-height,254px);padding:12px 15px calc(16px + env(safe-area-inset-bottom));overflow:auto}.sticker-tray-v57{max-width:560px;margin:0 auto}.sticker-tray-head-v57{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:0 2px 10px}.sticker-tray-head-v57 strong{font:400 22px var(--font-d);color:var(--chat-text)}.sticker-tray-head-v57 button{justify-self:start;border:0;background:transparent;color:var(--chat-muted);font:12px var(--font-b);cursor:pointer}.sticker-tray-head-v57 button:last-child{justify-self:end;color:var(--chat-accent)}.sticker-tray-packs-v57{display:flex;gap:7px;margin:0 -1px 12px;padding:2px 1px;overflow:auto;scrollbar-width:none}.sticker-tray-packs-v57::-webkit-scrollbar{display:none}.sticker-tray-packs-v57 button{flex:none;padding:7px 11px;border:1px solid var(--chat-border);border-radius:999px;background:var(--chat-surface);color:var(--chat-muted);font:12px var(--font-b);white-space:nowrap;cursor:pointer}.sticker-tray-packs-v57 button.active{border-color:var(--chat-accent);background:var(--chat-accent);color:var(--accent-contrast)}.sticker-tray-grid-v57{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.sticker-tray-grid-v57 button{position:relative;aspect-ratio:1;min-width:0;padding:0;overflow:hidden;border:1px solid var(--chat-border);border-radius:13px;background:var(--chat-surface);box-shadow:var(--shadow-xs);cursor:pointer}.sticker-tray-grid-v57 button:active{transform:scale(.96)}.sticker-tray-grid-v57 img{display:block;width:100%;height:100%;object-fit:cover}.sticker-tray-grid-v57 .upload{display:grid;place-items:center;border-style:dashed;background:color-mix(in srgb,var(--chat-surface) 72%,var(--accent-pale));color:var(--chat-accent);font:300 29px var(--font-d)}.sticker-tray-grid-v57 .empty{grid-column:1/-1;margin:0;padding:22px;color:var(--chat-muted);font:12px var(--font-b);text-align:center}</style>')}
function ensureStickerTrayV57(){const menu=ensureTransferAddMenuV41(),grid=menu?.querySelector('.transfer-add-grid-v41');if(!menu||!grid)return null;if(!$('stickerTrayV57'))grid.insertAdjacentHTML('afterend','<section class="sticker-tray-v57" id="stickerTrayV57" hidden><header class="sticker-tray-head-v57"><button type="button" data-sticker-tray-back>‹ 功能</button><strong>表情包</strong><button type="button" data-sticker-tray-manage>管理</button></header><div class="sticker-tray-packs-v57" id="stickerTrayPacksV57"></div><div class="sticker-tray-grid-v57" id="stickerTrayGridV57"></div></section>');const tray=$('stickerTrayV57');tray.querySelector('[data-sticker-tray-back]').onclick=()=>resetStickerTrayV57(menu);tray.querySelector('[data-sticker-tray-manage]').onclick=()=>location.href='stickers.html';return {menu,grid,tray}}
function resetStickerTrayV57(menu=$('companionAddMenuV32')){const grid=menu?.querySelector('.transfer-add-grid-v41'),tray=$('stickerTrayV57');if(grid)grid.hidden=false;if(tray)tray.hidden=true;menu?.classList.remove('sticker-browse-v57');document.documentElement.style.setProperty('--chat-add-panel-height','254px')}
function closeAddTrayV57(){const menu=$('companionAddMenuV32');resetStickerTrayV57(menu);if(menu){menu.classList.remove('open');menu.setAttribute('aria-hidden','true')}document.body.classList.remove('chat-add-open-v41')}
function renderStickerTrayV57(){const row=$('stickerTrayPacksV57'),grid=$('stickerTrayGridV57'),library=stickerLibraryV55;if(!row||!grid)return;const packs=[['all','全部'],['none','未分类'],...library.packs.map(pack=>[pack.id,pack.name])];row.innerHTML=packs.map(([id,name])=>'<button type="button" class="'+(stickerPackV55===id?'active':'')+'" data-sticker-tray-pack="'+stickerEscV55(id)+'">'+stickerEscV55(name)+'</button>').join('');row.querySelectorAll('[data-sticker-tray-pack]').forEach(button=>button.onclick=()=>{stickerPackV55=button.dataset.stickerTrayPack;renderStickerTrayV57()});const list=library.stickers.filter(item=>stickerPackV55==='all'||(stickerPackV55==='none'?!item.packId:item.packId===stickerPackV55));grid.innerHTML='<button type="button" class="upload" data-sticker-tray-upload aria-label="上传并发送表情">＋</button>'+list.map(item=>'<button type="button" data-sticker-tray-send="'+stickerEscV55(item.id)+'" aria-label="发送 '+stickerEscV55(item.name||'表情包')+'"><img src="'+stickerEscV55(item.imageUrl)+'" alt="'+stickerEscV55(item.name||'表情包')+'"></button>').join('')+(list.length?'':'<p class="empty">还没有表情包，先上传一张吧。</p>');grid.querySelector('[data-sticker-tray-upload]').onclick=()=>{$('stickerQuickInputV55')?.click()};grid.querySelectorAll('[data-sticker-tray-send]').forEach(button=>button.onclick=()=>sendStickerV55(button.dataset.stickerTraySend))}
openStickerPickerV55=async function(){if(!current)return toast('请先选择角色开始聊天','error');const view=ensureStickerTrayV57();if(!view)return;try{await loadStickerLibraryV55();renderStickerTrayV57();view.grid.hidden=true;view.tray.hidden=false;view.menu.classList.add('open','sticker-browse-v57');view.menu.setAttribute('aria-hidden','false');document.body.classList.add('chat-add-open-v41');document.documentElement.style.setProperty('--chat-add-panel-height','min(62dvh, 490px)')}catch(error){toast(error.message||'表情包库加载失败','error')}};
const sendStickerV57Base=sendStickerV55;sendStickerV55=async function(stickerId){closeAddTrayV57();return sendStickerV57Base(stickerId)};
openCompanionAddMenuV32=function(){const menu=ensureTransferAddMenuV41();if(menu.classList.contains('open'))return closeAddTrayV57();resetStickerTrayV57(menu);menu.classList.add('open');menu.setAttribute('aria-hidden','false');document.body.classList.add('chat-add-open-v41')};
function initStickerTrayV57(){injectStickerTrayV57Styles();const view=ensureStickerTrayV57();if(!view)return;view.menu.querySelector('[data-add-close]').onclick=closeAddTrayV57;const button=$('addImage');if(button)button.onclick=()=>openCompanionAddMenuV32()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initStickerTrayV57);else initStickerTrayV57();

/* V59: always enter the room with a clean attachment state.  This also
   prevents an interrupted sheet animation from leaving an invisible layer
   above the composer after a PWA resume. */
function restoreChatControlsV59(){document.documentElement.style.setProperty('--chat-add-panel-height','254px');document.body.classList.remove('chat-add-open-v41');const menu=$('companionAddMenuV32');if(menu){menu.classList.remove('open','sticker-browse-v57');menu.setAttribute('aria-hidden','true');const grid=menu.querySelector('.transfer-add-grid-v41'),tray=$('stickerTrayV57');if(grid)grid.hidden=false;if(tray)tray.hidden=true}const picker=$('stickerPickerV55');if(picker){picker.classList.remove('open');picker.setAttribute('aria-hidden','true')}const add=$('addImage');if(add){add.innerHTML=ICON.plus;add.setAttribute('aria-label','更多操作');add.onclick=()=>openCompanionAddMenuV32()}}
const openConversationV59Base=openConversation;openConversation=async function(id){restoreChatControlsV59();return openConversationV59Base(id)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restoreChatControlsV59);else restoreChatControlsV59();

/* V60: MCP connector settings.  Connectors are global configuration, while
   enablement belongs to the individual conversation.  Remote MCP calls are
   intentionally not made in this first UI pass. */
let mcpConnectorsV60=[],mcpConnectorsLoadingV60=null;
const mcpIconV60='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5h8a3.5 3.5 0 0 1 3.5 3.5v8a3.5 3.5 0 0 1-3.5 3.5H8A3.5 3.5 0 0 1 4.5 16V8A3.5 3.5 0 0 1 8 4.5Z"/><path d="M8.5 10h.01M15.5 10h.01M8.5 14c1.7 1.35 5.3 1.35 7 0"/></svg>';
function mcpEscV60(value){return esc(String(value??''))}
function mcpConfigV60(){const saved=current?.mcpConfig||{};return {enabled:saved.enabled===true,allConnectors:saved.allConnectors===true,connectorIds:Array.isArray(saved.connectorIds)?saved.connectorIds:[]}}
async function loadMcpConnectorsV60(force=false){if(!force&&mcpConnectorsV60.length)return mcpConnectorsV60;if(mcpConnectorsLoadingV60)return mcpConnectorsLoadingV60;mcpConnectorsLoadingV60=api('/api/chat/mcp-connectors').then(data=>{mcpConnectorsV60=Array.isArray(data?.connectors)?data.connectors:[];return mcpConnectorsV60}).finally(()=>{mcpConnectorsLoadingV60=null});return mcpConnectorsLoadingV60}
function injectMcpStylesV60(){if($('mcpStylesV60'))return;document.head.insertAdjacentHTML('beforeend','<style id="mcpStylesV60">.mcp-workspace-intro-v60{margin:0 0 15px;color:var(--chat-muted);font:13px/1.65 var(--font-b)}.mcp-warning-v60{margin:0 0 13px;padding:10px 12px;border:1px solid var(--chat-border);border-radius:12px;background:var(--accent-pale);color:var(--chat-muted);font:12px/1.6 var(--font-b)}.mcp-list-v60{display:grid;gap:10px}.mcp-card-v60{display:grid;grid-template-columns:37px 1fr auto;gap:10px;align-items:start;padding:13px;border:1px solid var(--chat-border);border-radius:14px;background:var(--chat-surface)}.mcp-card-icon-v60{display:grid;place-items:center;width:37px;height:37px;border-radius:12px;background:var(--accent-pale);color:var(--chat-accent)}.mcp-card-icon-v60 svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.mcp-card-v60 strong{display:block;color:var(--chat-text);font:600 14px var(--font-b)}.mcp-card-v60 p{margin:4px 0 0;color:var(--chat-muted);font:12px/1.5 var(--font-b)}.mcp-card-meta-v60{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.mcp-chip-v60{padding:3px 7px;border-radius:999px;background:var(--accent-pale);color:var(--chat-accent);font:11px var(--font-b)}.mcp-chip-v60.off{background:color-mix(in srgb,var(--chat-muted) 11%,transparent);color:var(--chat-muted)}.mcp-edit-v60{border:0;border-radius:9px;background:transparent;color:var(--chat-accent);font:12px var(--font-b);cursor:pointer;padding:6px}.mcp-form-v60{display:none}.mcp-form-v60.active{display:block}.mcp-form-head-v60{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px}.mcp-form-head-v60 h3{margin:0}.mcp-form-note-v60{margin:2px 0 10px;color:var(--chat-muted);font:11px/1.55 var(--font-b)}.mcp-danger-v60{color:#bd5a63!important;border-color:#e9c3c8!important}.mcp-chat-note-v60{margin:0 0 12px;color:var(--chat-muted);font:12px/1.55 var(--font-b)}.mcp-chat-list-v60{display:grid;gap:4px;border-top:1px dashed var(--chat-border);padding-top:9px}.mcp-chat-toggle-v60{display:flex;align-items:center;gap:8px;padding:6px 1px;color:var(--chat-text);font:12px var(--font-b)}.mcp-chat-toggle-v60 input{accent-color:var(--chat-accent)}.mcp-chat-toggle-v60 small{margin-left:auto;color:var(--chat-muted);font:11px var(--font-b)}</style>')}
function ensureMcpPanelV60(){if($('panel-mcp'))return;$('panel-archive')?.insertAdjacentHTML('afterend','<div class="panel" id="panel-mcp"><div class="card"><div class="mcp-form-head-v60"><h3>MCP 连接器</h3><button type="button" class="btn btn-mint" id="newMcpConnectorV60">＋ 新建连接器</button></div><p class="mcp-workspace-intro-v60">把常用的远程 MCP 工具保存在这里；每个聊天再决定是否交给 TA 使用。</p><p class="mcp-warning-v60">初版只完成保存与聊天级开关，不会从这里连接或调用远程服务。凭据不会再返回到浏览器。</p><div class="mcp-list-v60" id="mcpConnectorListV60"></div></div><div class="card mcp-form-v60" id="mcpConnectorFormCardV60"><div class="mcp-form-head-v60"><h3 id="mcpFormTitleV60">新建连接器</h3><button type="button" class="icon-btn" id="closeMcpFormV60" aria-label="关闭">×</button></div><input type="hidden" id="mcpConnectorIdV60"><div class="field"><label>名称</label><input id="mcpNameV60" maxlength="80" placeholder="例如：高德地图"></div><div class="field"><label>用途描述</label><textarea id="mcpDescriptionV60" rows="4" maxlength="600" placeholder="告诉 TA 这个连接器能做什么。"></textarea></div><div class="row"><div class="field"><label>类别</label><select id="mcpKindV60"><option value="custom">自定义工具</option><option value="music_player">聊天音乐播放器</option><option value="netease_app_control">网易云 App 控制</option><option value="maps">地图与出行</option></select></div><div class="field"><label>连接类型</label><select id="mcpTransportV60"><option value="httpStream">httpStream</option><option value="sse">SSE</option></select></div></div><div class="field"><label>服务地址</label><input id="mcpEndpointV60" type="url" inputmode="url" maxlength="1200" placeholder="https://example.com/mcp"></div><div class="field"><label>Bearer Token（可选）</label><input id="mcpBearerV60" type="password" autocomplete="new-password" placeholder="编辑时不会显示已保存的 Token"></div><label class="mcp-chat-toggle-v60" id="mcpClearTokenRowV60" hidden><input id="mcpClearBearerV60" type="checkbox"> 清除当前已保存的 Token</label><div class="field"><label>自定义请求头（可选，JSON）</label><textarea id="mcpHeadersV60" rows="3" placeholder="例如：键值对 JSON"></textarea><p class="mcp-form-note-v60">如填写 Authorization，它会覆盖 Bearer Token。初版不会向远程地址发起连接。</p></div><label class="setting-row"><span>允许被聊天使用</span><input class="switch" id="mcpEnabledV60" type="checkbox" checked></label><div class="actions"><button type="button" class="btn btn-mint" id="saveMcpConnectorV60">保存连接器</button><button type="button" class="btn btn-outline mcp-danger-v60" id="deleteMcpConnectorV60" hidden>删除</button></div></div></div>')}
function activateMcpPanelV60(){closeDrawers();ensureMcpPanelV60();document.body.classList.add('workspace-open');$('workspace').classList.add('open');document.querySelectorAll('.panel').forEach(panel=>panel.classList.remove('active'));$('panel-mcp').classList.add('active');$('workspaceTitle').textContent='MCP 连接器';renderMcpWorkspaceV60()}
function ensureMcpManagementEntryV60(){const root=$('leftSettingsMenuV14');if(!root||$('leftMcpConnectorEntryV60'))return;root.querySelector('.left-tool-shelf-v14')?.insertAdjacentHTML('beforeend','<button type="button" class="left-menu-action-v14" id="leftMcpConnectorEntryV60"><span class="left-menu-icon-v14">'+mcpIconV60+'</span>MCP</button>');$('leftMcpConnectorEntryV60').onclick=activateMcpPanelV60}
function mcpStatusV60(connector){return connector.enabled?'<span class="mcp-chip-v60">已保存</span>':'<span class="mcp-chip-v60 off">已关闭</span>'}
async function renderMcpWorkspaceV60(){ensureMcpPanelV60();const list=$('mcpConnectorListV60');if(!list)return;list.innerHTML='<p class="empty-note">正在读取连接器…</p>';try{const connectors=await loadMcpConnectorsV60(true);list.innerHTML=connectors.length?connectors.map(connector=>'<article class="mcp-card-v60"><span class="mcp-card-icon-v60">'+mcpIconV60+'</span><div><strong>'+mcpEscV60(connector.name)+'</strong><p>'+mcpEscV60(connector.description||'尚未填写用途说明')+'</p><div class="mcp-card-meta-v60">'+mcpStatusV60(connector)+'<span class="mcp-chip-v60 '+(connector.endpoint?'':'off')+'">'+(connector.endpoint?'已填地址':'未填地址')+'</span>'+(connector.hasBearerToken?'<span class="mcp-chip-v60">Token 已保存</span>':'')+'</div></div><button type="button" class="mcp-edit-v60" data-mcp-edit-v60="'+mcpEscV60(connector.id)+'">编辑</button></article>').join(''):'<p class="empty-note">还没有连接器。</p>';list.querySelectorAll('[data-mcp-edit-v60]').forEach(button=>button.onclick=()=>openMcpFormV60(mcpConnectorsV60.find(item=>item.id===button.dataset.mcpEditV60)))}catch(error){list.innerHTML='<p class="empty-note">读取失败：'+mcpEscV60(error.message||'未知错误')+'</p>'}}
function openMcpFormV60(connector=null){ensureMcpPanelV60();const form=$('mcpConnectorFormCardV60');form.classList.add('active');$('mcpFormTitleV60').textContent=connector?'编辑连接器':'新建连接器';$('mcpConnectorIdV60').value=connector?.id||'';$('mcpNameV60').value=connector?.name||'';$('mcpDescriptionV60').value=connector?.description||'';$('mcpKindV60').value=connector?.kind||'custom';$('mcpTransportV60').value=connector?.transport||'httpStream';$('mcpEndpointV60').value=connector?.endpoint||'';$('mcpBearerV60').value='';$('mcpEnabledV60').checked=connector?.enabled!==false;$('mcpClearBearerV60').checked=false;$('mcpClearTokenRowV60').hidden=!connector?.hasBearerToken;$('deleteMcpConnectorV60').hidden=!connector||connector.builtin===true;$('mcpHeadersV60').value='';form.scrollIntoView({behavior:'smooth',block:'start'})}
async function saveMcpFormV60(){const id=$('mcpConnectorIdV60').value;let headers={};const rawHeaders=$('mcpHeadersV60').value.trim();if(rawHeaders){try{headers=JSON.parse(rawHeaders)}catch(error){return toast('自定义请求头需要是 JSON 格式','error')}if(!headers||Array.isArray(headers)||typeof headers!=='object')return toast('自定义请求头需要是 JSON 对象','error')}const payload={name:$('mcpNameV60').value.trim(),description:$('mcpDescriptionV60').value.trim(),kind:$('mcpKindV60').value,transport:$('mcpTransportV60').value,endpoint:$('mcpEndpointV60').value.trim(),enabled:$('mcpEnabledV60').checked,headers,clearBearerToken:$('mcpClearBearerV60').checked};if(!payload.name)return toast('请填写连接器名称','error');if($('mcpBearerV60').value.trim())payload.bearerToken=$('mcpBearerV60').value.trim();try{await api(id?'/api/chat/mcp-connectors/'+encodeURIComponent(id):'/api/chat/mcp-connectors',{method:id?'PUT':'POST',body:JSON.stringify(payload)});$('mcpConnectorFormCardV60').classList.remove('active');await renderMcpWorkspaceV60();await renderMcpChatSettingsV60();toast('连接器已保存','success')}catch(error){toast(error.message||'保存失败','error')}}
function initMcpWorkspaceV60(){injectMcpStylesV60();ensureMcpPanelV60();ensureMcpManagementEntryV60();$('newMcpConnectorV60').onclick=()=>openMcpFormV60();$('closeMcpFormV60').onclick=()=>$('mcpConnectorFormCardV60').classList.remove('active');$('saveMcpConnectorV60').onclick=saveMcpFormV60;$('deleteMcpConnectorV60').onclick=async()=>{const id=$('mcpConnectorIdV60').value;if(!id||!confirm('删除这个连接器吗？'))return;try{await api('/api/chat/mcp-connectors/'+encodeURIComponent(id),{method:'DELETE'});$('mcpConnectorFormCardV60').classList.remove('active');await renderMcpWorkspaceV60();await renderMcpChatSettingsV60();toast('连接器已删除','success')}catch(error){toast(error.message||'删除失败','error')}}}
const openPanelV60Base=openPanel;openPanel=function(name){if(name==='mcp')return activateMcpPanelV60();return openPanelV60Base(name)};
function ensureMcpChatSettingsV60(){const root=$('rightSettingsMenuV12');if(!root||$('mcpChatSettingsV60'))return;const section=document.createElement('section');section.id='mcpChatSettingsV60';section.className='right-menu-section';section.dataset.rightSection='mcpV60';section.innerHTML='<button type="button" class="right-menu-summary" aria-expanded="false" data-mcp-toggle-v60><span class="right-menu-icon">'+mcpIconV60+'</span><span>MCP 工具</span><svg class="right-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button><div class="right-menu-panel" id="rightMenuPanel-mcpV60"></div>';const storage=root.querySelector('[data-right-section="storage"]');root.insertBefore(section,storage||null);section.querySelector('[data-mcp-toggle-v60]').onclick=function(){const open=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!open));if(!open)renderMcpChatSettingsV60()}}
async function renderMcpChatSettingsV60(){ensureMcpChatSettingsV60();const panel=$('rightMenuPanel-mcpV60');if(!panel)return;if(!current){panel.innerHTML='<p class="empty-note">打开一个聊天后即可设置。</p>';return}panel.innerHTML='<p class="mcp-chat-note-v60">本聊天独立设置。关闭后，TA 不会获得任何 MCP 连接器。</p><label class="setting-row"><span>允许 TA 使用 MCP</span><input class="switch" id="mcpChatEnabledV60" type="checkbox"></label><label class="setting-row"><span>全部已保存连接器可用</span><input class="switch" id="mcpChatAllV60" type="checkbox"></label><div class="mcp-chat-list-v60" id="mcpChatListV60"><p class="empty-note">正在读取…</p></div>';try{const connectors=await loadMcpConnectorsV60();const config=mcpConfigV60();const list=$('mcpChatListV60');list.innerHTML=connectors.length?connectors.map(connector=>'<label class="mcp-chat-toggle-v60"><input type="checkbox" value="'+mcpEscV60(connector.id)+'" data-mcp-chat-id-v60 '+(config.allConnectors||config.connectorIds.includes(connector.id)?'checked':'')+'><span>'+mcpEscV60(connector.name)+'</span><small>'+(!connector.enabled?'全局关闭':'')+'</small></label>').join(''):'<p class="empty-note">先在左侧管理中创建连接器。</p>';$('mcpChatEnabledV60').checked=config.enabled;$('mcpChatAllV60').checked=config.allConnectors;const save=async()=>{const next={enabled:$('mcpChatEnabledV60').checked,allConnectors:$('mcpChatAllV60').checked,connectorIds:Array.from(panel.querySelectorAll('[data-mcp-chat-id-v60]:checked')).map(input=>input.value)};panel.querySelectorAll('[data-mcp-chat-id-v60]').forEach(input=>input.disabled=!next.enabled||next.allConnectors);$('mcpChatAllV60').disabled=!next.enabled;try{await updateConversation(current.id,{mcpConfig:next});toast('MCP 设置已保存','success')}catch(error){toast(error.message||'保存失败','error')}};$('mcpChatEnabledV60').onchange=save;$('mcpChatAllV60').onchange=save;panel.querySelectorAll('[data-mcp-chat-id-v60]').forEach(input=>input.onchange=save);panel.querySelectorAll('[data-mcp-chat-id-v60]').forEach(input=>input.disabled=!config.enabled||config.allConnectors);$('mcpChatAllV60').disabled=!config.enabled}catch(error){$('mcpChatListV60').innerHTML='<p class="empty-note">读取失败：'+mcpEscV60(error.message||'未知错误')+'</p>'}}
const hydrateRightV60Base=hydrateRight;hydrateRight=function(){hydrateRightV60Base();ensureMcpChatSettingsV60();renderMcpChatSettingsV60()};
function initMcpV60(){initMcpWorkspaceV60();ensureMcpChatSettingsV60()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMcpV60);else initMcpV60();

// Credentials and custom headers are write-only in the editor.  Leaving the
// field blank while changing a connector must not accidentally erase them.
saveMcpFormV60=async function(){const id=$('mcpConnectorIdV60').value;let headers;const rawHeaders=$('mcpHeadersV60').value.trim();if(rawHeaders){try{headers=JSON.parse(rawHeaders)}catch(error){return toast('自定义请求头需要是 JSON 格式','error')}if(!headers||Array.isArray(headers)||typeof headers!=='object')return toast('自定义请求头需要是 JSON 对象','error')}const payload={name:$('mcpNameV60').value.trim(),description:$('mcpDescriptionV60').value.trim(),kind:$('mcpKindV60').value,transport:$('mcpTransportV60').value,endpoint:$('mcpEndpointV60').value.trim(),enabled:$('mcpEnabledV60').checked,clearBearerToken:$('mcpClearBearerV60').checked};if(headers!==undefined)payload.headers=headers;if(!payload.name)return toast('请填写连接器名称','error');if($('mcpBearerV60').value.trim())payload.bearerToken=$('mcpBearerV60').value.trim();try{await api(id?'/api/chat/mcp-connectors/'+encodeURIComponent(id):'/api/chat/mcp-connectors',{method:id?'PUT':'POST',body:JSON.stringify(payload)});$('mcpConnectorFormCardV60').classList.remove('active');await renderMcpWorkspaceV60();await renderMcpChatSettingsV60();toast('连接器已保存','success')}catch(error){toast(error.message||'保存失败','error')}};

/* V61: keep the attachment sheet compact and scroll its sticker grid inside
   the sheet.  AI text and an optional sticker are one stored message, so draw
   both rather than allowing the image renderer to hide the text. */
function injectStickerTrayFixV61(){if($('stickerTrayFixV61'))return;document.head.insertAdjacentHTML('beforeend','<style id="stickerTrayFixV61">.transfer-add-menu-v41.sticker-browse-v57 .transfer-add-panel-v41{height:360px;min-height:360px;max-height:50dvh;padding:12px 15px calc(13px + env(safe-area-inset-bottom));overflow:hidden}.sticker-tray-v57{display:flex;flex-direction:column;min-height:0;height:100%}.sticker-tray-head-v57,.sticker-tray-packs-v57{flex:none}.sticker-tray-grid-v57{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain;padding:2px 1px 8px;align-content:start;scrollbar-width:thin}.sticker-message-v61{display:grid;gap:7px}.sticker-message-v61 .chat-sticker-v55{margin:0}.message-group.user .sticker-message-v61 .chat-sticker-v55{margin-left:auto}</style>')}
const messageContentV61Base=messageContentV6;
messageContentV6=function(message,index){if(!message?.sticker)return messageContentV61Base(message,index);if(message.recalled)return messageContentV61Base(message,index);const item=message.sticker,id=stickerEscV55(message.id||''),text=message.role==='claude'?String(message.content||'').trim():'';const bubble=text?'<div class="bubble">'+esc(text)+'</div>':'';return '<article class="chat-message-item sticker-message-v55 sticker-message-v61" data-message-id="'+id+'">'+bubble+'<button type="button" class="chat-sticker-v55" title="'+stickerEscV55(item.name||'表情包')+'"><img src="'+stickerEscV55(item.imageUrl)+'" alt="'+stickerEscV55(item.name||item.description||'表情包')+'"></button></article>'};
openStickerPickerV55=async function(){if(!current)return toast('请先选择角色开始聊天','error');const view=ensureStickerTrayV57();if(!view)return;try{await loadStickerLibraryV55();renderStickerTrayV57();view.grid.hidden=true;view.tray.hidden=false;view.menu.classList.add('open','sticker-browse-v57');view.menu.setAttribute('aria-hidden','false');document.body.classList.add('chat-add-open-v41');document.documentElement.style.setProperty('--chat-add-panel-height','360px')}catch(error){toast(error.message||'表情包库加载失败','error')}};
function initStickerFixV61(){injectStickerTrayFixV61();renderMessages()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initStickerFixV61);else initStickerFixV61();

/* V62: the MCP library is deliberately a compact tool shelf.  Connector
   metadata is global; the chat drawer still decides which saved entries TA
   may use in the current room. */
const mcpPuzzleIconV62='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.3 4.3h2.1a2.2 2.2 0 1 1 4.4 0h1.4a2 2 0 0 1 2 2v3.1a2.2 2.2 0 1 0 0 4.4v3.2a2 2 0 0 1-2 2h-3.1a2.2 2.2 0 1 1-4.4 0H5.8a2 2 0 0 1-2-2v-3.2a2.2 2.2 0 1 0 0-4.4V6.3a2 2 0 0 1 2-2h2.5"/></svg>';
function injectMcpV62Styles(){if($('mcpV62Styles'))return;document.head.insertAdjacentHTML('beforeend','<style id="mcpV62Styles">.mcp-v62-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.mcp-v62-head h3{margin:0;font:400 20px var(--font-d)}.mcp-v62-head button{white-space:nowrap}.mcp-v62-list{display:grid;gap:10px}.mcp-v62-card{padding:13px 13px 12px;border:1px solid var(--chat-border);border-radius:15px;background:var(--chat-surface)}.mcp-v62-card-head{display:flex;align-items:center;gap:9px}.mcp-v62-icon{display:grid;place-items:center;width:36px;height:36px;flex:none;border-radius:11px;background:var(--accent-pale);color:var(--chat-accent)}.mcp-v62-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}.mcp-v62-name{flex:1;min-width:0;color:var(--chat-text);font:600 14px var(--font-b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcp-v62-switch{appearance:none;width:37px;height:22px;border-radius:22px;background:var(--accent-light);position:relative;cursor:pointer;flex:none}.mcp-v62-switch:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--chat-surface);transition:.18s}.mcp-v62-switch:checked{background:var(--chat-accent)}.mcp-v62-switch:checked:after{transform:translateX(15px)}.mcp-v62-tools{display:flex;gap:6px;overflow:auto;margin:11px 0 10px;padding-bottom:1px;scrollbar-width:none}.mcp-v62-tools::-webkit-scrollbar{display:none}.mcp-v62-tool{flex:none;max-width:172px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;border-radius:999px;background:var(--accent-pale);color:var(--chat-accent);font:11px ui-monospace,SFMono-Regular,Consolas,monospace}.mcp-v62-tool.muted{background:color-mix(in srgb,var(--chat-muted) 10%,transparent);color:var(--chat-muted);font-family:var(--font-b)}.mcp-v62-actions{display:flex;gap:8px}.mcp-v62-actions button{flex:1;padding:8px;border:1px solid var(--chat-border);border-radius:9px;background:transparent;color:var(--chat-text);font:12px var(--font-b);cursor:pointer}.mcp-v62-actions .danger{color:#b75961;border-color:#ecc9cd}.mcp-v62-form{margin-top:15px}.mcp-v62-form h3{margin:0 0 12px;font:400 20px var(--font-d)}.mcp-v62-form .field{margin:12px 0}.mcp-v62-form .field textarea{min-height:78px}.mcp-v62-form .row{gap:8px}.mcp-v62-form .field small{display:block;margin-top:5px;color:var(--chat-muted);font:11px var(--font-b)}.left-menu-icon-v14.mcp-v62 svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}</style>')}
function ensureMcpPanelV62(){const panel=$('panel-mcp');if(!panel||panel.dataset.mcpV62==='true')return;panel.dataset.mcpV62='true';panel.innerHTML='<div class="card"><div class="mcp-v62-head"><h3>已保存的 MCP</h3><button type="button" class="btn btn-mint" id="newMcpConnectorV62">＋</button></div><div class="mcp-v62-list" id="mcpConnectorListV60"></div></div><div class="card mcp-v62-form" id="mcpConnectorFormCardV60"><h3 id="mcpFormTitleV60">新建 MCP</h3><input type="hidden" id="mcpConnectorIdV60"><input type="hidden" id="mcpKindV60" value="custom"><div class="field"><label>名称</label><input id="mcpNameV60" maxlength="80" placeholder="例如：高德地图"></div><div class="field"><label>说明（给 AI）</label><textarea id="mcpDescriptionV60" rows="3" maxlength="600" placeholder="这个 MCP 可以做什么"></textarea></div><div class="field"><label>服务地址</label><input id="mcpEndpointV60" type="url" inputmode="url" maxlength="1200" placeholder="https://example.com/mcp"></div><div class="field"><label>连接类型</label><select id="mcpTransportV60"><option value="httpStream">httpStream</option><option value="sse">SSE</option></select></div><div class="field"><label>Bearer Token（可选）</label><input id="mcpBearerV60" type="password" autocomplete="new-password" placeholder="仅服务要求认证时填写"></div><label class="mcp-chat-toggle-v60" id="mcpClearTokenRowV60" hidden><input id="mcpClearBearerV60" type="checkbox"> 清除已保存的 Token</label><div class="field"><label>自定义请求头（可选，JSON）</label><textarea id="mcpHeadersV60" rows="2" placeholder="仅服务文档要求时填写"></textarea></div><label class="setting-row"><span>启用</span><input class="switch" id="mcpEnabledV60" type="checkbox" checked></label><div class="actions"><button type="button" class="btn btn-mint" id="saveMcpConnectorV60">保存并读取工具</button></div></div>'}
function compactMcpToolNamesV62(connector){const names=(connector.tools||[]).map(tool=>tool?.name).filter(Boolean);if(names.length)return names;return [connector.lastToolError?'读取失败':'尚未读取工具']}
function openMcpFormV62(connector=null){ensureMcpPanelV62();$('mcpFormTitleV60').textContent=connector?'编辑 MCP':'新建 MCP';$('mcpConnectorIdV60').value=connector?.id||'';$('mcpNameV60').value=connector?.name||'';$('mcpDescriptionV60').value=connector?.description||'';$('mcpEndpointV60').value=connector?.endpoint||'';$('mcpTransportV60').value=connector?.transport||'httpStream';$('mcpBearerV60').value='';$('mcpEnabledV60').checked=connector?.enabled!==false;$('mcpClearBearerV60').checked=false;$('mcpClearTokenRowV60').hidden=!connector?.hasBearerToken;$('mcpHeadersV60').value='';$('mcpConnectorFormCardV60').scrollIntoView({behavior:'smooth',block:'start'})}
async function renderMcpWorkspaceV62(){ensureMcpPanelV62();const list=$('mcpConnectorListV60');if(!list)return;list.innerHTML='<p class="empty-note">正在读取…</p>';try{const connectors=await loadMcpConnectorsV60(true);list.innerHTML=connectors.length?connectors.map(connector=>'<article class="mcp-v62-card"><div class="mcp-v62-card-head"><i class="mcp-v62-icon">'+mcpPuzzleIconV62+'</i><strong class="mcp-v62-name">'+mcpEscV60(connector.name)+'</strong><input class="mcp-v62-switch" type="checkbox" data-mcp-enable-v62="'+mcpEscV60(connector.id)+'" '+(connector.enabled!==false?'checked':'')+' aria-label="启用 '+mcpEscV60(connector.name)+'"></div><div class="mcp-v62-tools">'+compactMcpToolNamesV62(connector).slice(0,7).map(name=>'<span class="mcp-v62-tool '+((connector.tools||[]).length?'':'muted')+'">'+mcpEscV60(name)+'</span>').join('')+((connector.tools||[]).length>7?'<span class="mcp-v62-tool muted">+'+((connector.tools||[]).length-7)+'</span>':'')+'</div><div class="mcp-v62-actions"><button type="button" data-mcp-refresh-v62="'+mcpEscV60(connector.id)+'">刷新工具</button><button type="button" data-mcp-edit-v62="'+mcpEscV60(connector.id)+'">编辑</button><button type="button" class="danger" data-mcp-delete-v62="'+mcpEscV60(connector.id)+'">删除</button></div></article>').join(''):'<p class="empty-note">还没有已保存的 MCP。</p>';list.querySelectorAll('[data-mcp-enable-v62]').forEach(input=>input.onchange=async()=>{try{await api('/api/chat/mcp-connectors/'+encodeURIComponent(input.dataset.mcpEnableV62),{method:'PUT',body:JSON.stringify({enabled:input.checked})});await renderMcpWorkspaceV62();await renderMcpChatSettingsV60()}catch(error){toast(error.message||'保存失败','error');input.checked=!input.checked}});list.querySelectorAll('[data-mcp-edit-v62]').forEach(button=>button.onclick=()=>openMcpFormV62(mcpConnectorsV60.find(item=>item.id===button.dataset.mcpEditV62)));list.querySelectorAll('[data-mcp-refresh-v62]').forEach(button=>button.onclick=async()=>{button.disabled=true;button.textContent='读取中…';try{await api('/api/chat/mcp-connectors/'+encodeURIComponent(button.dataset.mcpRefreshV62)+'/refresh',{method:'POST'});await renderMcpWorkspaceV62();await renderMcpChatSettingsV60();toast('工具已更新','success')}catch(error){toast(error.message||'读取失败','error')}finally{button.disabled=false}});list.querySelectorAll('[data-mcp-delete-v62]').forEach(button=>button.onclick=async()=>{const connector=mcpConnectorsV60.find(item=>item.id===button.dataset.mcpDeleteV62);if(!connector||!confirm('删除“'+connector.name+'”吗？'))return;try{await api('/api/chat/mcp-connectors/'+encodeURIComponent(connector.id),{method:'DELETE'});openMcpFormV62();await renderMcpWorkspaceV62();await renderMcpChatSettingsV60();toast('已删除','success')}catch(error){toast(error.message||'删除失败','error')}})}catch(error){list.innerHTML='<p class="empty-note">读取失败：'+mcpEscV60(error.message||'未知错误')+'</p>'}}
async function saveMcpFormV62(){const id=$('mcpConnectorIdV60').value,rawHeaders=$('mcpHeadersV60').value.trim();let headers;if(rawHeaders){try{headers=JSON.parse(rawHeaders)}catch(error){return toast('请求头需要是 JSON 格式','error')}if(!headers||Array.isArray(headers)||typeof headers!=='object')return toast('请求头需要是 JSON 对象','error')}const payload={name:$('mcpNameV60').value.trim(),description:$('mcpDescriptionV60').value.trim(),kind:'custom',transport:$('mcpTransportV60').value,endpoint:$('mcpEndpointV60').value.trim(),enabled:$('mcpEnabledV60').checked,clearBearerToken:$('mcpClearBearerV60').checked};if(headers!==undefined)payload.headers=headers;if($('mcpBearerV60').value.trim())payload.bearerToken=$('mcpBearerV60').value.trim();if(!payload.name||!payload.endpoint)return toast('请填写名称和服务地址','error');const button=$('saveMcpConnectorV60');button.disabled=true;button.textContent='读取工具…';try{await api(id?'/api/chat/mcp-connectors/'+encodeURIComponent(id):'/api/chat/mcp-connectors',{method:id?'PUT':'POST',body:JSON.stringify(payload)});openMcpFormV62();await renderMcpWorkspaceV62();await renderMcpChatSettingsV60();toast('MCP 已保存','success')}catch(error){toast(error.message||'保存失败','error')}finally{button.disabled=false;button.textContent='保存并读取工具'}}
function initMcpV62(){injectMcpV62Styles();ensureMcpPanelV62();const entry=$('leftMcpConnectorEntryV60');if(entry){entry.innerHTML='<span class="left-menu-icon-v14 mcp-v62">'+mcpPuzzleIconV62+'</span>MCP';entry.onclick=activateMcpPanelV60}$('newMcpConnectorV62').onclick=()=>openMcpFormV62();$('saveMcpConnectorV60').onclick=saveMcpFormV62();openMcpFormV62();}
renderMcpWorkspaceV60=renderMcpWorkspaceV62;openMcpFormV60=openMcpFormV62;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMcpV62);else initMcpV62();

/* V63: MCP saves must never look inert.  The action is captured at the
   document level as a recovery path for mobile PWA event restoration. */
function injectMcpFeedbackV63(){if($('mcpFeedbackV63'))return;document.head.insertAdjacentHTML('beforeend','<style id="mcpFeedbackV63">.mcp-v62-status{min-height:18px;margin:9px 1px 0;color:var(--chat-muted);font:12px var(--font-b)}.mcp-v62-status.error{color:#b75961}.mcp-v62-error{margin:0 1px 9px;color:#b75961;font:11px/1.45 var(--font-b)}</style>')}
function ensureMcpFeedbackV63(){ensureMcpPanelV62();const form=$('mcpConnectorFormCardV60');if(form&&!$('mcpSaveStatusV63'))form.insertAdjacentHTML('beforeend','<p class="mcp-v62-status" id="mcpSaveStatusV63" aria-live="polite"></p>');const right=$('mcpChatSettingsV60');const icon=right?.querySelector('.right-menu-icon');if(icon)icon.innerHTML=mcpPuzzleIconV62}
function mcpSaveStatusV63(message='',error=false){const node=$('mcpSaveStatusV63');if(!node)return;node.textContent=message;node.classList.toggle('error',!!error)}
async function saveMcpFormV63(){ensureMcpFeedbackV63();const id=$('mcpConnectorIdV60').value,rawHeaders=$('mcpHeadersV60').value.trim();let headers;if(rawHeaders){try{headers=JSON.parse(rawHeaders)}catch(error){mcpSaveStatusV63('请求头不是有效 JSON',true);return toast('请求头需要是 JSON 格式','error')}if(!headers||Array.isArray(headers)||typeof headers!=='object'){mcpSaveStatusV63('请求头需要是 JSON 对象',true);return toast('请求头需要是 JSON 对象','error')}}const payload={name:$('mcpNameV60').value.trim(),description:$('mcpDescriptionV60').value.trim(),kind:'custom',transport:$('mcpTransportV60').value,endpoint:$('mcpEndpointV60').value.trim(),enabled:$('mcpEnabledV60').checked,clearBearerToken:$('mcpClearBearerV60').checked};if(headers!==undefined)payload.headers=headers;if($('mcpBearerV60').value.trim())payload.bearerToken=$('mcpBearerV60').value.trim();if(!payload.name||!payload.endpoint){mcpSaveStatusV63('请填写名称和服务地址',true);return toast('请填写名称和服务地址','error')}const button=$('saveMcpConnectorV60');button.disabled=true;button.textContent='保存中…';mcpSaveStatusV63('正在保存并读取工具…');try{const saved=await api(id?'/api/chat/mcp-connectors/'+encodeURIComponent(id):'/api/chat/mcp-connectors',{method:id?'PUT':'POST',body:JSON.stringify(payload)});openMcpFormV62();await renderMcpWorkspaceV62();await renderMcpChatSettingsV60();if(saved?.lastToolError){mcpSaveStatusV63('已保存，但读取工具失败：'+saved.lastToolError,true);toast('MCP 已保存，但工具读取失败','error')}else{mcpSaveStatusV63('已保存，工具已读取。');toast('MCP 已保存并读取工具','success')}}catch(error){mcpSaveStatusV63('保存失败：'+(error.message||'未知错误'),true);toast(error.message||'保存失败','error')}finally{button.disabled=false;button.textContent='保存并读取工具'}}
function initMcpFeedbackV63(){injectMcpFeedbackV63();ensureMcpFeedbackV63();$('saveMcpConnectorV60').onclick=saveMcpFormV63();document.addEventListener('click',event=>{const button=event.target.closest('#saveMcpConnectorV60');if(!button)return;event.preventDefault();event.stopImmediatePropagation();saveMcpFormV63()},true)}
const renderMcpWorkspaceV63Base=renderMcpWorkspaceV60;
renderMcpWorkspaceV60=async function(){await renderMcpWorkspaceV63Base();const list=$('mcpConnectorListV60');list?.querySelectorAll('.mcp-v62-card').forEach((card,index)=>{const connector=mcpConnectorsV60[index];if(connector?.lastToolError)card.insertAdjacentHTML('beforeend','<p class="mcp-v62-error">'+mcpEscV60(connector.lastToolError)+'</p>')});};
const hydrateRightV63Base=hydrateRight;hydrateRight=function(){hydrateRightV63Base();ensureMcpFeedbackV63()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMcpFeedbackV63);else initMcpFeedbackV63();

/* V64: keep the sticker tray responsive for large libraries, and isolate the
   MCP save control so a touch elsewhere in chat can never validate its form. */
function injectStickerAndMcpFixV64(){if($('stickerAndMcpFixV64'))return;document.head.insertAdjacentHTML('beforeend','<style id="stickerAndMcpFixV64">.transfer-add-menu-v41.sticker-browse-v57 .transfer-add-panel-v41{height:360px;min-height:360px;max-height:none}.sticker-tray-head-v57{grid-template-columns:1fr 1fr}.sticker-tray-head-v57 strong{display:none}.sticker-tray-grid-v57{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start}.sticker-tray-grid-v57 button{width:calc((100% - 32px)/5);height:auto;flex:0 0 calc((100% - 32px)/5);aspect-ratio:1}.sticker-tray-grid-v57 .empty{width:100%;flex-basis:100%}.sticker-tray-grid-v57 .loading{width:100%;flex-basis:100%;margin:0;padding:25px 0;color:var(--chat-muted);font:12px var(--font-b);text-align:center}</style>')}
function renderStickerTrayV64(){const row=$('stickerTrayPacksV57'),grid=$('stickerTrayGridV57'),library=stickerLibraryV55;if(!row||!grid)return;const packs=[['all','全部'],['none','未分类'],...library.packs.map(pack=>[pack.id,pack.name])];row.innerHTML=packs.map(([id,name])=>'<button type="button" class="'+(stickerPackV55===id?'active':'')+'" data-sticker-tray-pack="'+stickerEscV55(id)+'">'+stickerEscV55(name)+'</button>').join('');row.querySelectorAll('[data-sticker-tray-pack]').forEach(button=>button.onclick=()=>{stickerPackV55=button.dataset.stickerTrayPack;renderStickerTrayV64()});const list=library.stickers.filter(item=>stickerPackV55==='all'||(stickerPackV55==='none'?!item.packId:item.packId===stickerPackV55));grid.innerHTML='<button type="button" class="upload" data-sticker-tray-upload aria-label="上传并发送表情">＋</button>'+list.map(item=>'<button type="button" data-sticker-tray-send="'+stickerEscV55(item.id)+'" aria-label="发送 '+stickerEscV55(item.name||'表情包')+'"><img loading="lazy" decoding="async" src="'+stickerEscV55(item.imageUrl)+'" alt="'+stickerEscV55(item.name||'表情包')+'"></button>').join('')+(list.length?'':'<p class="empty">还没有表情包，先上传一张吧。</p>');grid.querySelector('[data-sticker-tray-upload]').onclick=()=>$('stickerQuickInputV55')?.click();grid.querySelectorAll('[data-sticker-tray-send]').forEach(button=>button.onclick=()=>sendStickerV55(button.dataset.stickerTraySend))}
renderStickerTrayV57=renderStickerTrayV64;
openStickerPickerV55=async function(){if(!current)return toast('请先选择角色开始聊天','error');const view=ensureStickerTrayV57();if(!view)return;view.grid.hidden=true;view.tray.hidden=false;view.menu.classList.add('open','sticker-browse-v57');view.menu.setAttribute('aria-hidden','false');document.body.classList.add('chat-add-open-v41');document.documentElement.style.setProperty('--chat-add-panel-height','360px');if(stickerLibraryV55.stickers.length)renderStickerTrayV64();else $('stickerTrayGridV57').innerHTML='<p class="loading">正在载入表情包…</p>';try{await loadStickerLibraryV55();renderStickerTrayV64()}catch(error){$('stickerTrayGridV57').innerHTML='<p class="loading">表情包库加载失败</p>';toast(error.message||'表情包库加载失败','error')}};
async function saveMcpFormV64(){ensureMcpFeedbackV63();const id=$('mcpConnectorIdV60').value,rawHeaders=$('mcpHeadersV60').value.trim();let headers;if(rawHeaders){try{headers=JSON.parse(rawHeaders)}catch(error){mcpSaveStatusV63('请求头不是有效 JSON',true);return toast('请求头需要是 JSON 格式','error')}if(!headers||Array.isArray(headers)||typeof headers!=='object'){mcpSaveStatusV63('请求头需要是 JSON 对象',true);return toast('请求头需要是 JSON 对象','error')}}const payload={name:$('mcpNameV60').value.trim(),description:$('mcpDescriptionV60').value.trim(),kind:'custom',transport:$('mcpTransportV60').value,endpoint:$('mcpEndpointV60').value.trim(),enabled:$('mcpEnabledV60').checked,clearBearerToken:$('mcpClearBearerV60').checked};if(headers!==undefined)payload.headers=headers;if($('mcpBearerV60').value.trim())payload.bearerToken=$('mcpBearerV60').value.trim();if(!payload.name||!payload.endpoint){mcpSaveStatusV63('请填写名称和服务地址',true);return toast('请填写名称和服务地址','error')}const button=$('saveMcpConnectorV65')||$('saveMcpConnectorV64');if(!button)return;button.disabled=true;button.textContent='保存中…';mcpSaveStatusV63('正在保存并读取工具…');try{const saved=await api(id?'/api/chat/mcp-connectors/'+encodeURIComponent(id):'/api/chat/mcp-connectors',{method:id?'PUT':'POST',body:JSON.stringify(payload)});openMcpFormV62();await renderMcpWorkspaceV60();await renderMcpChatSettingsV60();if(saved?.lastToolError){mcpSaveStatusV63('已保存，但读取工具失败：'+saved.lastToolError,true);toast('MCP 已保存，但工具读取失败','error')}else{mcpSaveStatusV63('已保存，工具已读取。');toast('MCP 已保存并读取工具','success')}}catch(error){mcpSaveStatusV63('保存失败：'+(error.message||'未知错误'),true);toast(error.message||'保存失败','error')}finally{button.disabled=false;button.textContent='保存并读取工具'}}
function initV64(){injectStickerAndMcpFixV64();const old=$('saveMcpConnectorV60');if(old){old.id='saveMcpConnectorV64';old.onclick=saveMcpFormV64}const tray=$('stickerTrayV57');if(tray)tray.querySelector('.sticker-tray-head-v57 strong')?.remove()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initV64);else initV64();

/* V65: keep long MCP inventories inside their cards, and retire the old
   document-level save handler so it can never validate a hidden MCP form. */
function injectMcpPolishV65(){if($('mcpPolishV65'))return;document.head.insertAdjacentHTML('beforeend','<style id="mcpPolishV65">.mcp-v62-card{min-width:0;overflow:hidden}.mcp-v62-tools{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden}.mcp-v62-tool{min-width:0;max-width:calc((100vw - 168px)/3);overflow:hidden;text-overflow:ellipsis}.mcp-v65-more{display:grid;place-items:center;flex:none;width:25px;height:25px;padding:0;border:0;border-radius:50%;background:var(--accent-pale);color:var(--chat-accent);font:18px/1 var(--font-b);cursor:pointer}.mcp-tool-sheet-v65{position:fixed;inset:0;z-index:1300;display:none;align-items:flex-end;background:rgba(48,39,33,.24);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}.mcp-tool-sheet-v65.open{display:flex}.mcp-tool-sheet-card-v65{box-sizing:border-box;width:100%;max-height:min(70dvh,560px);padding:10px 19px calc(20px + env(safe-area-inset-bottom));overflow:auto;border-radius:28px 28px 0 0;background:var(--chat-surface);box-shadow:0 -10px 28px rgba(51,38,31,.14)}.mcp-tool-sheet-grab-v65{width:38px;height:5px;margin:0 auto 14px;border-radius:99px;background:color-mix(in srgb,var(--chat-muted) 30%,transparent)}.mcp-tool-sheet-head-v65{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.mcp-tool-sheet-head-v65 h3{min-width:0;margin:0;color:var(--chat-text);font:400 22px var(--font-d);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcp-tool-sheet-head-v65 button{display:grid;place-items:center;flex:none;width:31px;height:31px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--chat-muted);font:25px/1 var(--font-b);cursor:pointer}.mcp-tool-list-v65{display:grid;gap:7px}.mcp-tool-list-v65 span{padding:10px 12px;border:1px solid var(--chat-border);border-radius:12px;background:var(--accent-pale);color:var(--chat-text);font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}.turn-tool-row-head-v23>div{flex:1;min-width:0}.turn-tool-row-head-v23 strong,.turn-tool-row-head-v23 small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.turn-tool-row-head-v23 i{flex:none}.turn-tool-row-head-v23{gap:9px}</style>')}
function mcpToolsV65(connector){return (connector?.tools||[]).map(tool=>String(tool?.name||'').trim()).filter(Boolean)}
function ensureMcpToolSheetV65(){if($('mcpToolSheetV65'))return;document.body.insertAdjacentHTML('beforeend','<section class="mcp-tool-sheet-v65" id="mcpToolSheetV65" aria-hidden="true"><button type="button" class="mcp-tool-sheet-backdrop-v65" data-mcp-tool-sheet-close aria-label="关闭"></button><div class="mcp-tool-sheet-card-v65" role="dialog" aria-modal="true"><div class="mcp-tool-sheet-grab-v65"></div><header class="mcp-tool-sheet-head-v65"><h3 id="mcpToolSheetTitleV65">MCP 工具</h3><button type="button" data-mcp-tool-sheet-close aria-label="关闭">×</button></header><div class="mcp-tool-list-v65" id="mcpToolSheetListV65"></div></div></section>');const sheet=$('mcpToolSheetV65'),close=()=>{sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true')};sheet.querySelectorAll('[data-mcp-tool-sheet-close]').forEach(button=>button.onclick=close)}
function openMcpToolSheetV65(connector){const tools=mcpToolsV65(connector);if(!tools.length)return;ensureMcpToolSheetV65();$('mcpToolSheetTitleV65').textContent=(connector?.name||'MCP')+' · 工具';$('mcpToolSheetListV65').innerHTML=tools.map(name=>'<span>'+mcpEscV60(name)+'</span>').join('');const sheet=$('mcpToolSheetV65');sheet.classList.add('open');sheet.setAttribute('aria-hidden','false')}
const renderMcpWorkspaceV65Base=renderMcpWorkspaceV60;
renderMcpWorkspaceV60=async function(){await renderMcpWorkspaceV65Base();const list=$('mcpConnectorListV60');if(!list)return;list.querySelectorAll('.mcp-v62-card').forEach((card,index)=>{const connector=mcpConnectorsV60[index],tools=mcpToolsV65(connector),strip=card.querySelector('.mcp-v62-tools');if(!strip||!tools.length)return;const visible=tools.slice(0,3),remaining=Math.max(0,tools.length-visible.length);strip.innerHTML=visible.map(name=>'<span class="mcp-v62-tool" title="'+mcpEscV60(name)+'">'+mcpEscV60(name)+'</span>').join('')+(remaining?'<span class="mcp-v62-tool muted">+'+remaining+'</span>':'')+'<button type="button" class="mcp-v65-more" data-mcp-show-tools-v65="'+index+'" aria-label="查看全部工具">⌄</button>';strip.querySelector('[data-mcp-show-tools-v65]').onclick=()=>openMcpToolSheetV65(connector)})};
function isMcpEditorActiveV65(){const panel=$('panel-mcp'),form=$('mcpConnectorFormCardV60');return !!(panel&&form&&document.body.classList.contains('workspace-open')&&panel.classList.contains('active')&&form.getClientRects().length)}
const saveMcpFormV65Base=saveMcpFormV64;
saveMcpFormV64=async function(){if(!isMcpEditorActiveV65())return;return saveMcpFormV65Base()};
saveMcpFormV63=async function(){if(!isMcpEditorActiveV65())return;return saveMcpFormV64()};
function claimMcpSaveButtonV65(){const button=$('saveMcpConnectorV60')||$('saveMcpConnectorV64')||$('saveMcpConnectorV65');if(!button)return;button.id='saveMcpConnectorV65';button.onclick=saveMcpFormV64}
function initMcpPolishV65(){injectMcpPolishV65();claimMcpSaveButtonV65();ensureMcpToolSheetV65();window.addEventListener('click',event=>{const legacy=event.target?.closest?.('#saveMcpConnectorV60');if(!legacy)return;legacy.id='saveMcpConnectorV65';legacy.onclick=saveMcpFormV64},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMcpPolishV65);else initMcpPolishV65();

/* V66: MCP cards are a summary only; the full names live in the expandable
   tool sheet.  Reuse this renderer for refreshes as well as initial loading. */
function injectMcpSummaryV66(){if($('mcpSummaryV66'))return;document.head.insertAdjacentHTML('beforeend','<style id="mcpSummaryV66">.mcp-v62-tools{justify-content:space-between;min-height:31px;padding:1px 0}.mcp-v66-count{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--chat-muted);font:12px var(--font-b)}.mcp-v65-more{width:29px;height:29px;font-size:19px}</style>')}
const renderMcpWorkspaceV66Base=renderMcpWorkspaceV60;
renderMcpWorkspaceV60=async function(){await renderMcpWorkspaceV66Base();const list=$('mcpConnectorListV60');if(!list)return;list.querySelectorAll('.mcp-v62-card').forEach((card,index)=>{const connector=mcpConnectorsV60[index],tools=mcpToolsV65(connector),strip=card.querySelector('.mcp-v62-tools');if(!strip)return;if(!tools.length){strip.innerHTML='<span class="mcp-v66-count">尚未读取工具</span>';return}strip.innerHTML='<span class="mcp-v66-count">已读取 '+tools.length+' 个工具</span><button type="button" class="mcp-v65-more" data-mcp-show-tools-v66="'+index+'" aria-label="查看 '+tools.length+' 个工具">⌄</button>';strip.querySelector('[data-mcp-show-tools-v66]').onclick=()=>openMcpToolSheetV65(connector)})};
// Existing refresh and save paths called the V62 renderer by name.  Point it
// at the final renderer so the compact summary never disappears after refresh.
renderMcpWorkspaceV62=renderMcpWorkspaceV60;
function initMcpSummaryV66(){injectMcpSummaryV66()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMcpSummaryV66);else initMcpSummaryV66();

/* V67: the MCP form already has its own inline validation.  Never let its
   legacy generic toast leak into chat or any other workspace. */
const toastV67Base=toast;
toast=function(message,type=''){if(String(message||'').trim()==='请填写名称和服务地址')return;return toastV67Base(message,type)};

/* V68: native music cards returned by the music-player MCP.  They live in
   the same stored assistant message as the spoken reply, not as a widget. */
function musicColorV68(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback}
function musicTimeV68(seconds){const value=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(value/60)+':'+String(value%60).padStart(2,'0')}
function musicCardMarkupV68(music,messageId){const item=music||{},title=String(item.songName||'未知歌曲').slice(0,180),artist=String(item.artistName||'未知歌手').slice(0,180),audio=String(item.audioUrl||''),cover=String(item.coverUrl||''),lyrics=String(item.lyrics||'');if(!/^https:\/\//i.test(audio))return '';const primary=musicColorV68(item.colorPrimary,'#6e7c87'),secondary=musicColorV68(item.colorSecondary,'#CAE0E8'),bg=musicColorV68(item.colorBg,'#1a1d21'),end=musicColorV68(item.colorBgEnd,'#2a2d31');return '<section class="chat-music-v68" data-music-card data-message-id="'+esc(messageId)+'" style="--music-primary:'+primary+';--music-secondary:'+secondary+';--music-bg:'+bg+';--music-bg-end:'+end+'"><audio preload="metadata" src="'+esc(audio)+'" data-music-audio></audio><div class="chat-music-top-v68">'+(cover?'<img class="chat-music-cover-v68" src="'+esc(cover)+'" alt="'+esc(title)+' 封面">':'<div class="chat-music-cover-v68 fallback">♫</div>')+'<div class="chat-music-meta-v68"><strong title="'+esc(title)+'">'+esc(title)+'</strong><span title="'+esc(artist)+'">'+esc(artist)+'</span></div><button type="button" class="chat-music-play-v68" data-music-play aria-label="播放 '+esc(title)+'">▶</button></div><div class="chat-music-progress-v68"><span data-music-current>0:00</span><input type="range" min="0" max="'+Math.max(1,Number(item.duration)||1)+'" value="0" step="0.1" data-music-progress aria-label="播放进度"><span data-music-duration>'+musicTimeV68(item.duration)+'</span></div>'+(lyrics?'<button type="button" class="chat-music-lyrics-toggle-v68" data-music-lyrics>歌词 <span>⌄</span></button><pre class="chat-music-lyrics-v68" data-music-lyrics-panel hidden>'+esc(lyrics)+'</pre>':'')+'<small class="chat-music-status-v68" data-music-status></small></section>'}
function injectMusicCardsV68(){if($('musicCardsV68'))return;document.head.insertAdjacentHTML('beforeend','<style id="musicCardsV68">.chat-music-v68{box-sizing:border-box;width:min(286px,68vw);margin-top:7px;padding:11px;border-radius:18px;background:linear-gradient(135deg,var(--music-bg),var(--music-bg-end));color:#fff;box-shadow:0 6px 16px color-mix(in srgb,var(--music-bg) 38%,transparent);overflow:hidden}.message-group.user .chat-music-v68{margin-left:auto}.chat-music-top-v68{display:flex;align-items:center;gap:10px;min-width:0}.chat-music-cover-v68{display:block;flex:none;width:50px;height:50px;border-radius:12px;object-fit:cover;background:var(--music-secondary)}.chat-music-cover-v68.fallback{display:grid;place-items:center;color:var(--music-primary);font:26px/1 var(--font-d)}.chat-music-meta-v68{display:grid;min-width:0;flex:1;gap:3px}.chat-music-meta-v68 strong,.chat-music-meta-v68 span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chat-music-meta-v68 strong{font:600 14px/1.25 var(--font-b)}.chat-music-meta-v68 span{opacity:.72;font:12px/1.25 var(--font-b)}.chat-music-play-v68{display:grid;place-items:center;flex:none;width:35px;height:35px;padding:0;border:0;border-radius:50%;background:var(--music-secondary);color:var(--music-bg);font:15px/1 var(--font-b);cursor:pointer}.chat-music-progress-v68{display:grid;grid-template-columns:32px 1fr 32px;align-items:center;gap:6px;margin-top:11px;color:color-mix(in srgb,#fff 76%,transparent);font:10px/1 var(--font-b)}.chat-music-progress-v68 input{width:100%;height:3px;margin:0;accent-color:var(--music-secondary);cursor:pointer}.chat-music-lyrics-toggle-v68{display:flex;align-items:center;gap:4px;margin:9px 0 0;padding:0;border:0;background:transparent;color:var(--music-secondary);font:11px var(--font-b);cursor:pointer}.chat-music-lyrics-toggle-v68 span{transition:transform .18s}.chat-music-v68.lyrics-open .chat-music-lyrics-toggle-v68 span{transform:rotate(180deg)}.chat-music-lyrics-v68{max-height:145px;margin:8px 0 0;padding:8px;overflow:auto;border-radius:9px;background:rgba(255,255,255,.09);color:rgba(255,255,255,.83);font:11px/1.62 var(--font-b);white-space:pre-wrap}.chat-music-status-v68{display:block;min-height:0;margin-top:0;color:#ffd6d6;font:10px/1.4 var(--font-b)}.chat-music-status-v68:not(:empty){margin-top:7px}</style>')}
function musicCardForV68(node){return node?.closest?.('[data-music-card]')||null}
function syncMusicCardV68(card){const audio=card?.querySelector('[data-music-audio]'),range=card?.querySelector('[data-music-progress]'),current=card?.querySelector('[data-music-current]'),duration=card?.querySelector('[data-music-duration]'),play=card?.querySelector('[data-music-play]');if(!audio||!range)return;const total=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:Number(range.max)||0;range.max=Math.max(1,total);range.value=Math.min(total,Number(audio.currentTime)||0);if(current)current.textContent=musicTimeV68(audio.currentTime);if(duration)duration.textContent=musicTimeV68(total);if(play){play.textContent=audio.paused?'▶':'❚❚';play.setAttribute('aria-label',(audio.paused?'播放':'暂停')+' '+(card.querySelector('.chat-music-meta-v68 strong')?.textContent||'音乐'))}}
let activeMusicAudioV68=null;
function initMusicCardsV68(){injectMusicCardsV68();const root=$('messages');if(!root||root.dataset.musicCardsV68)return;root.dataset.musicCardsV68='true';root.addEventListener('click',async event=>{const play=event.target.closest('[data-music-play]');if(play){const card=musicCardForV68(play),audio=card?.querySelector('[data-music-audio]'),status=card?.querySelector('[data-music-status]');if(!audio)return;if(audio.paused){if(activeMusicAudioV68&&activeMusicAudioV68!==audio){activeMusicAudioV68.pause();syncMusicCardV68(musicCardForV68(activeMusicAudioV68))}try{if(status)status.textContent='';await audio.play();activeMusicAudioV68=audio}catch(error){if(status)status.textContent='播放失败，链接可能已过期。'}}else audio.pause();syncMusicCardV68(card);return}const lyrics=event.target.closest('[data-music-lyrics]');if(lyrics){const card=musicCardForV68(lyrics),panel=card?.querySelector('[data-music-lyrics-panel]');if(panel){const open=panel.hidden;panel.hidden=!open;card.classList.toggle('lyrics-open',open)}return}});root.addEventListener('input',event=>{const range=event.target.closest('[data-music-progress]');if(!range)return;const card=musicCardForV68(range),audio=card?.querySelector('[data-music-audio]');if(audio){audio.currentTime=Number(range.value)||0;syncMusicCardV68(card)}});['loadedmetadata','timeupdate','play','pause','ended','error'].forEach(type=>root.addEventListener(type,event=>{const audio=event.target.closest?.('[data-music-audio]');if(!audio)return;const card=musicCardForV68(audio);if(type==='error'){const status=card?.querySelector('[data-music-status]');if(status)status.textContent='播放失败，链接可能已过期。'}syncMusicCardV68(card)},true))}
const messageContentV68Base=messageContentV6;
messageContentV6=function(message,index){const markup=messageContentV68Base(message,index);if(!message?.music||message.recalled)return markup;const card=musicCardMarkupV68(message.music,String(message.id||''));return card?markup.replace(/<\/article>$/,card+'</article>'):markup};
function initMusicMessagesV68(){initMusicCardsV68();renderMessages()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMusicMessagesV68);else initMusicMessagesV68();

/* V69: preserve playback through chat redraws and sync LRC lyrics. */
function lyricMarkupV69(value){const rows=[];String(value||'').split(/\r?\n/).forEach(line=>{const tags=[...line.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)],text=line.replace(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g,'').trim();if(!tags.length){if(text&&!/^\[(?:ti|ar|al|by|offset):/i.test(text))rows.push({time:null,text});return}tags.forEach(tag=>rows.push({time:Number(tag[1])*60+Number(tag[2])+Number(String(tag[3]||'0').padEnd(3,'0').slice(0,3))/1000,text:text||'♪'}))});return rows.length?rows.map(row=>'<p'+(Number.isFinite(row.time)?' data-lyric-at="'+row.time+'"':'')+'>'+esc(row.text)+'</p>').join(''):'<p>'+esc(String(value||''))+'</p>'}
function musicCardMarkupV69(music,messageId){const item=music||{},title=String(item.songName||'未知歌曲').slice(0,180),artist=String(item.artistName||'未知歌手').slice(0,180),audio=String(item.audioUrl||''),cover=String(item.coverUrl||''),lyrics=String(item.lyrics||'');if(!/^https:\/\//i.test(audio))return '';const primary=musicColorV68(item.colorPrimary,'#6e7c87'),secondary=musicColorV68(item.colorSecondary,'#CAE0E8'),bg=musicColorV68(item.colorBg,'#1a1d21'),end=musicColorV68(item.colorBgEnd,'#2a2d31');return '<section class="chat-music-v68" data-music-card data-message-id="'+esc(messageId)+'" style="--music-primary:'+primary+';--music-secondary:'+secondary+';--music-bg:'+bg+';--music-bg-end:'+end+'"><audio preload="metadata" src="'+esc(audio)+'" data-music-audio></audio><div class="chat-music-top-v68">'+(cover?'<img class="chat-music-cover-v68" src="'+esc(cover)+'" alt="'+esc(title)+' 封面">':'<div class="chat-music-cover-v68 fallback">♫</div>')+'<div class="chat-music-meta-v68"><strong title="'+esc(title)+'">'+esc(title)+'</strong><span title="'+esc(artist)+'">'+esc(artist)+'</span></div><button type="button" class="chat-music-play-v68" data-music-play aria-label="播放 '+esc(title)+'">▶</button></div><div class="chat-music-progress-v68"><span data-music-current>0:00</span><input type="range" min="0" max="'+Math.max(1,Number(item.duration)||1)+'" value="0" step="0.1" data-music-progress aria-label="播放进度"><span data-music-duration>'+musicTimeV68(item.duration)+'</span></div>'+(lyrics?'<button type="button" class="chat-music-lyrics-toggle-v68" data-music-lyrics>词 <span>⌄</span></button><div class="chat-music-lyrics-v68" data-music-lyrics-panel hidden>'+lyricMarkupV69(lyrics)+'</div>':'')+'<small class="chat-music-status-v68" data-music-status></small></section>'}
function syncMusicLyricsV69(card){const audio=card?.querySelector('[data-music-audio]'),panel=card?.querySelector('[data-music-lyrics-panel]');if(!audio||!panel||panel.hidden)return;const lines=[...panel.querySelectorAll('[data-lyric-at]')];let active=null;for(const line of lines){if(Number(line.dataset.lyricAt)<=audio.currentTime+.06)active=line;else break}if(!active||active===panel._activeLyricV69)return;panel._activeLyricV69=active;lines.forEach(line=>line.classList.toggle('active',line===active));active.scrollIntoView({block:'center',behavior:'smooth'});}
function injectMusicCardsV69(){if($('musicCardsV69'))return;document.head.insertAdjacentHTML('beforeend','<style id="musicCardsV69">.chat-music-lyrics-v68{scroll-behavior:smooth}.chat-music-lyrics-v68 p{margin:0;padding:2px 0;opacity:.46;transition:opacity .18s,color .18s,transform .18s}.chat-music-lyrics-v68 p.active{opacity:1;color:var(--music-secondary);font-weight:700;transform:translateX(2px)}</style>')}
const renderMessagesV69Base=renderMessages;
renderMessages=function(){const audio=activeMusicAudioV68,oldCard=audio?.closest?.('[data-music-card]'),messageId=oldCard?.dataset.messageId,preserve=!!(audio&&messageId&&!audio.paused&&audio.isConnected);if(preserve)document.body.appendChild(audio);renderMessagesV69Base();if(!preserve)return;const replacement=[...($('messages')?.querySelectorAll('[data-music-card]')||[])].find(card=>card.dataset.messageId===messageId)?.querySelector('[data-music-audio]');if(!replacement){audio.pause();activeMusicAudioV68=null;return}replacement.replaceWith(audio);syncMusicCardV68(audio.closest('[data-music-card]'));};
const syncMusicCardV69Base=syncMusicCardV68;
syncMusicCardV68=function(card){syncMusicCardV69Base(card);syncMusicLyricsV69(card)};
document.addEventListener('click',event=>{const toggle=event.target.closest?.('[data-music-lyrics]');if(toggle){const card=musicCardForV68(toggle);setTimeout(()=>syncMusicLyricsV69(card),0)}});
injectMusicCardsV69();
const messageContentV69Base=messageContentV68Base;
messageContentV6=function(message,index){const markup=messageContentV69Base(message,index);if(!message?.music||message.recalled)return markup;const card=musicCardMarkupV69(message.music,String(message.id||''));return card?markup.replace(/<\/article>$/,card+'</article>'):markup};
renderMessages();

/* V70: per-room music-card polish, with the same swatch + hexadecimal input
   pattern as bubble text colours. Empty fields keep the MCP-provided palette. */
const MUSIC_CARD_DEFAULTS_V70={musicCardBg:'#1A1D21',musicCardEnd:'#2A2D31',musicCardText:'#FFFFFF',musicCardSubtext:'#C9CED4',musicCardAccent:'#CAE0E8'};
function musicHexV70(value,fallback){const text=String(value||'').trim().replace(/^#/,'');return /^[0-9a-f]{6}$/i.test(text)?'#'+text.toUpperCase():fallback}
function applyMusicAppearanceV70(){const appearance=current?.appearance||{};Object.entries(MUSIC_CARD_DEFAULTS_V70).forEach(([key,fallback])=>{const value=appearance[key];const css='--chat-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());if(/^#[0-9a-f]{6}$/i.test(String(value||'')))document.documentElement.style.setProperty(css,musicHexV70(value,fallback));else document.documentElement.style.removeProperty(css)})}
function ensureMusicCardSettingsV70(){const panel=$('rightMenuPanel-beauty'),anchor=$('transferCardColorRowV44')||$('aiBubble')?.closest('.setting-row');if(!panel||!anchor||$('musicCardBgV70'))return;anchor.insertAdjacentHTML('afterend','<div class="music-card-settings-v70"><p class="room-appearance-heading-v14 colour-group-heading-v15">音乐卡片</p><label class="setting-row"><span>卡片主色</span><input id="musicCardBgV70" type="color"><input class="colour-code-input" id="musicCardBgV70Code" type="text" inputmode="text" maxlength="7" placeholder="1A1D21" aria-label="音乐卡片主色代码"></label><label class="setting-row"><span>卡片渐变色</span><input id="musicCardEndV70" type="color"><input class="colour-code-input" id="musicCardEndV70Code" type="text" inputmode="text" maxlength="7" placeholder="2A2D31" aria-label="音乐卡片渐变色代码"></label><label class="setting-row"><span>标题文字</span><input id="musicCardTextV70" type="color"><input class="colour-code-input" id="musicCardTextV70Code" type="text" inputmode="text" maxlength="7" placeholder="FFFFFF" aria-label="音乐卡片标题文字代码"></label><label class="setting-row"><span>辅助文字</span><input id="musicCardSubtextV70" type="color"><input class="colour-code-input" id="musicCardSubtextV70Code" type="text" inputmode="text" maxlength="7" placeholder="C9CED4" aria-label="音乐卡片辅助文字代码"></label><label class="setting-row"><span>按钮与高亮</span><input id="musicCardAccentV70" type="color"><input class="colour-code-input" id="musicCardAccentV70Code" type="text" inputmode="text" maxlength="7" placeholder="CAE0E8" aria-label="音乐卡片按钮与高亮代码"></label></div>');Object.keys(MUSIC_CARD_DEFAULTS_V70).forEach(key=>{const input=$(key+'V70'),code=$(key+'V70Code');if(!input||!code)return;const sync=()=>{input.value=musicHexV70(input.value,MUSIC_CARD_DEFAULTS_V70[key]);code.value=input.value.slice(1)};input.oninput=()=>{sync();const appearance={...(current?.appearance||{}),[key]:input.value};current.appearance=appearance;applyMusicAppearanceV70()};input.onchange=async()=>{const appearance={...(current?.appearance||{}),[key]:input.value};try{await updateConversation(current.id,{appearance});current.appearance=appearance;applyMusicAppearanceV70();toast('音乐卡片美化已保存','success')}catch(error){toast('保存设置失败：'+error.message,'error')}};code.onchange=()=>{input.value=musicHexV70(code.value,input.value||MUSIC_CARD_DEFAULTS_V70[key]);sync();input.dispatchEvent(new Event('change'))};sync()})}
function hydrateMusicCardSettingsV70(){ensureMusicCardSettingsV70();const appearance=current?.appearance||{};Object.entries(MUSIC_CARD_DEFAULTS_V70).forEach(([key,fallback])=>{const input=$(key+'V70'),code=$(key+'V70Code');if(!input||!code)return;input.value=musicHexV70(appearance[key],fallback);code.value=input.value.slice(1)});applyMusicAppearanceV70()}
function injectMusicCardAppearanceV70(){if($('musicCardAppearanceV70'))return;document.head.insertAdjacentHTML('beforeend','<style id="musicCardAppearanceV70">.chat-music-v68{background:linear-gradient(135deg,var(--chat-music-card-bg,var(--music-bg)),var(--chat-music-card-end,var(--music-bg-end)))!important;color:var(--chat-music-card-text,#fff)}.chat-music-meta-v68 strong{color:var(--chat-music-card-text,#fff)}.chat-music-meta-v68 span,.chat-music-progress-v68{color:var(--chat-music-card-subtext,color-mix(in srgb,#fff 76%,transparent))}.chat-music-play-v68{background:var(--chat-music-card-accent,var(--music-secondary));color:var(--chat-music-card-bg,var(--music-bg))}.chat-music-progress-v68 input{accent-color:var(--chat-music-card-accent,var(--music-secondary))}.chat-music-lyrics-toggle-v68,.chat-music-lyrics-v68 p.active{color:var(--chat-music-card-accent,var(--music-secondary))}.music-card-settings-v70{margin-top:10px}.music-card-settings-v70 .setting-row{gap:8px}</style>')}
const hydrateRightV70Base=hydrateRight;
hydrateRight=function(){hydrateRightV70Base();hydrateMusicCardSettingsV70()};
function initMusicCardAppearanceV70(){injectMusicCardAppearanceV70();applyMusicAppearanceV70()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMusicCardAppearanceV70);else initMusicCardAppearanceV70();

/* V71: a room can either read as one grouped reply or give every bubble its
   own avatar and timestamp. Existing rooms keep the compact grouping. */
function ensureMergeBubblesSettingV71(){const panel=$('rightMenuPanel-display'),anchor=$('multiBubble')?.closest('.setting-row');if(!panel||!anchor||$('mergeBubblesV71'))return;anchor.insertAdjacentHTML('afterend','<label class="setting-row" id="mergeBubblesRowV71"><span>合并气泡<small>关闭后每个气泡显示头像</small></span><input class="switch" id="mergeBubblesV71" type="checkbox"></label>');$('mergeBubblesV71').onchange=async()=>{if(!current)return;try{await updateConversation(current.id,{mergeBubbles:$('mergeBubblesV71').checked});renderMessages()}catch(error){$('mergeBubblesV71').checked=current?.mergeBubbles!==false;toast('保存设置失败：'+error.message,'error')}}}
function hydrateMergeBubblesSettingV71(){ensureMergeBubblesSettingV71();const input=$('mergeBubblesV71');if(input)input.checked=current?.mergeBubbles!==false}
const hydrateRightV71Base=hydrateRight;
hydrateRight=function(){hydrateRightV71Base();hydrateMergeBubblesSettingV71()};

/* V72: a sticker or music card can share one stored message with the spoken
   reply. In unmerged mode, still give every visual piece its own avatar row. */
function avatarRowV72(message,role,markup){const user=message.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(message.createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',stack='<div class="bubble-stack">'+markup+'</div>';return '<div class="message-group '+(user?'user':'assistant')+' message-piece-v72">'+(user?stack+person:person+stack)+'</div>'}
function splitMessagePiecesV72(message,index){const host=document.createElement('div');host.innerHTML=messageContentV6(message,index);const article=host.firstElementChild;if(!article||article.tagName!=='ARTICLE')return [host.innerHTML];const cards=[...article.children].filter(node=>node.matches?.('.chat-sticker-v55,[data-music-card]'));if(!cards.length)return [article.outerHTML];const spoken=article.cloneNode(false);[...article.childNodes].forEach(node=>{if(node.nodeType===1&&cards.includes(node))return;if(node.nodeType===3&&!node.textContent.trim())return;spoken.append(node.cloneNode(true))});const pieces=[];if(spoken.childNodes.length)pieces.push(spoken.outerHTML);cards.forEach(card=>{const single=article.cloneNode(false);single.append(card.cloneNode(true));pieces.push(single.outerHTML)});return pieces.length?pieces:[article.outerHTML]}
const renderGroupV72Base=renderGroup;
renderGroup=function(group,role){if(current?.mergeBubbles!==false||group?.isSystem||group?.messages?.[0]?.transfer||group?.messages?.[0]?.companionInvitation||group?.messages?.[0]?.companionCompletion||group?.messages?.[0]?.systemType==='companion_completion')return renderGroupV72Base(group,role);return group.messages.flatMap((message,index)=>splitMessagePiecesV72(message,index).map(markup=>avatarRowV72(message,role,markup))).join('')};

/* V73: photos can share a message with its caption too. Split every visual
   unit in document order, so an image followed by text keeps that order and
   both receive their own avatar when bubble merging is disabled. */
function splitMessagePiecesV73(message,index){const host=document.createElement('div');host.innerHTML=messageContentV6(message,index);const article=host.firstElementChild;if(!article||article.tagName!=='ARTICLE')return [host.innerHTML];const isVisual=node=>node?.nodeType===1&&node.matches?.('.chat-sticker-v55,[data-music-card],.chat-photo-single,.chat-photo-group,.sent-image');if(![...article.childNodes].some(isVisual))return [article.outerHTML];const pieces=[];let spoken=article.cloneNode(false);const flush=()=>{if([...spoken.childNodes].some(node=>node.nodeType!==3||node.textContent.trim()))pieces.push(spoken.outerHTML);spoken=article.cloneNode(false)};[...article.childNodes].forEach(node=>{if(isVisual(node)){flush();const single=article.cloneNode(false);single.append(node.cloneNode(true));pieces.push(single.outerHTML)}else if(node.nodeType!==3||node.textContent.trim())spoken.append(node.cloneNode(true))});flush();return pieces.length?pieces:[article.outerHTML]}
renderGroup=function(group,role){if(current?.mergeBubbles!==false||group?.isSystem||group?.messages?.[0]?.transfer||group?.messages?.[0]?.companionInvitation||group?.messages?.[0]?.companionCompletion||group?.messages?.[0]?.systemType==='companion_completion')return renderGroupV72Base(group,role);return group.messages.flatMap((message,index)=>splitMessagePiecesV73(message,index).map(markup=>avatarRowV72(message,role,markup))).join('')};

/* V74: private daily notes.  They intentionally stay outside the message
   stream: an unread note decorates TA's header avatar and opens as a quiet
   profile-like card instead. */
const DAILY_NOTE_LABEL_V74='日常';
if(!TOOL_GROUPS_V17.some(group=>group[0]==='日常'))TOOL_GROUPS_V17.push(['日常',['publish_daily_note'],['发布碎碎念']]);
let dailyNotesV74=[];
function dailyRoleV74(){return roles.find(role=>role.id===current?.roleId)||null}
function dailyEscV74(value){return esc(value||'')}
function dailyDateV74(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}
async function loadDailyNotesV74(){const role=dailyRoleV74();if(!role){dailyNotesV74=[];return []}const data=await api('/api/chat/daily-notes?roleId='+encodeURIComponent(role.id));dailyNotesV74=Array.isArray(data.notes)?data.notes:[];return dailyNotesV74}
function ensureDailyNotesV74(){if($('dailyNotesRootV74'))return;document.body.insertAdjacentHTML('beforeend','<section class="daily-notes-root-v74" id="dailyNotesRootV74" aria-hidden="true"><button type="button" class="daily-notes-backdrop-v74" data-daily-close-v74 aria-label="关闭"></button><article class="daily-note-card-v74" role="dialog" aria-modal="true"><button type="button" class="daily-note-close-v74" data-daily-close-v74 aria-label="关闭">×</button><div class="daily-note-person-v74"><div class="daily-note-avatar-v74" id="dailyNoteAvatarV74"></div><strong id="dailyNoteNameV74">TA</strong><time id="dailyNoteTimeV74"></time></div><section class="daily-note-paper-v74"><small id="dailyNoteLabelV74"></small><p id="dailyNoteContentV74"></p></section></article></section><section class="daily-compose-root-v74" id="dailyComposeRootV74" aria-hidden="true"><button type="button" class="daily-notes-backdrop-v74" data-daily-compose-close-v74 aria-label="关闭"></button><article class="daily-compose-card-v74"><button type="button" class="daily-note-close-v74" data-daily-compose-close-v74 aria-label="关闭">×</button><h2>发布碎碎念</h2><textarea id="dailyComposeTextV74" maxlength="500" placeholder="写下此刻想留下的一句话…"></textarea><div><button type="button" class="daily-secondary-v74" id="dailyHistoryV74">查看历史</button><button type="button" class="daily-primary-v74" id="dailyPublishV74">发布</button></div></article></section>');const close=()=>{const root=$('dailyNotesRootV74');root.classList.remove('open');root.setAttribute('aria-hidden','true')};const closeComposer=()=>{const root=$('dailyComposeRootV74');root.classList.remove('open');root.setAttribute('aria-hidden','true')};document.querySelectorAll('[data-daily-close-v74]').forEach(button=>button.onclick=close);document.querySelectorAll('[data-daily-compose-close-v74]').forEach(button=>button.onclick=closeComposer);$('dailyHistoryV74').onclick=()=>openDailyHistoryV74();$('dailyPublishV74').onclick=publishDailyNoteV74}
function openDailyHistoryV74(){const role=dailyRoleV74();if(!role)return toast('请先选择聊天角色','error');location.href='daily.html?roleId='+encodeURIComponent(role.id)}
async function openDailyComposeV74(){if(!current)return toast('请先选择角色开始聊天','error');ensureDailyNotesV74();closeAddTrayV57?.();const root=$('dailyComposeRootV74');root.classList.add('open');root.setAttribute('aria-hidden','false');setTimeout(()=>$('dailyComposeTextV74')?.focus(),120)}
async function publishDailyNoteV74(){const role=dailyRoleV74(),content=$('dailyComposeTextV74')?.value.trim();if(!role)return toast('请先选择聊天角色','error');if(!content)return toast('写一句再发布吧','error');const button=$('dailyPublishV74');button.disabled=true;button.textContent='发布中…';try{const note=await api('/api/chat/daily-notes',{method:'POST',body:JSON.stringify({roleId:role.id,content})});dailyNotesV74.unshift(note);$('dailyComposeTextV74').value='';$('dailyComposeRootV74').classList.remove('open');$('dailyComposeRootV74').setAttribute('aria-hidden','true');toast('碎碎念已发布','success')}catch(error){toast(error.message||'发布失败','error')}finally{button.disabled=false;button.textContent='发布'}}
async function openDailyViewerV74(note){const role=dailyRoleV74();if(!role)return;ensureDailyNotesV74();$('dailyNoteAvatarV74').innerHTML=roleAvatar(role);$('dailyNoteNameV74').textContent=role.name||'TA';$('dailyNoteTimeV74').textContent=dailyDateV74(note?.createdAt);$('dailyNoteLabelV74').textContent=DAILY_NOTE_LABEL_V74;$('dailyNoteContentV74').textContent=note?.content||'TA 还没有留下新的碎碎念。';const root=$('dailyNotesRootV74');root.classList.add('open');root.setAttribute('aria-hidden','false');if(dailyNotesV74.some(item=>item.author==='claude'&&!item.readAt)){try{await api('/api/chat/daily-notes/read',{method:'POST',body:JSON.stringify({roleId:role.id})});dailyNotesV74=dailyNotesV74.map(item=>item.author==='claude'?{...item,readAt:new Date().toISOString()}:item);syncDailyAvatarV74()}catch(error){console.warn('daily note read state failed:',error.message)}}}
function syncDailyAvatarV74(){const avatar=$('chatTitle')?.querySelector('.chat-title-role-avatar');if(!avatar)return;const unread=dailyNotesV74.some(note=>note.author==='claude'&&!note.readAt);avatar.classList.toggle('has-daily-note-v74',unread);avatar.removeAttribute('aria-hidden');avatar.tabIndex=0;avatar.setAttribute('role','button');avatar.setAttribute('aria-label',unread?'查看 TA 未读日常':'查看 TA 的日常');const open=()=>openDailyViewerV74(dailyNotesV74.find(note=>note.author==='claude'&&!note.readAt)||dailyNotesV74.find(note=>note.author==='claude'));avatar.onclick=open;avatar.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}}
function attachDailyAddButtonV74(){const menu=ensureTransferAddMenuV41?.();const grid=menu?.querySelector('.transfer-add-grid-v41');if(!grid||grid.querySelector('[data-add-daily-v74]'))return;grid.insertAdjacentHTML('beforeend','<button type="button" data-add-daily-v74><i class="daily-add-icon-v74">✦</i><span>日常</span></button>');grid.querySelector('[data-add-daily-v74]').onclick=openDailyComposeV74}
function injectDailyNoteStylesV74(){if($('dailyNoteStylesV74'))return;document.head.insertAdjacentHTML('beforeend','<style id="dailyNoteStylesV74">.chat-title-role-avatar{cursor:pointer}.chat-title-role-avatar.has-daily-note-v74:before{content:"";position:absolute;inset:-4px;border-radius:50%;padding:2px;background:conic-gradient(#ff9eb5,#ffd66d,#84d7cd,#9f9bff,#ff9eb5);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:dailyRainbowV74 3.4s linear infinite}.chat-title-role-avatar.has-daily-note-v74 .chat-title-role-avatar-image{position:relative;z-index:1}@keyframes dailyRainbowV74{to{transform:rotate(1turn)}}.daily-add-icon-v74{background:color-mix(in srgb,#ffb6c8 22%,var(--chat-surface))!important;color:#b87988!important;font-style:normal;font:24px/1 var(--font-d)!important}.daily-notes-root-v74,.daily-compose-root-v74{position:fixed;z-index:2200;inset:0;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(55,43,37,.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.daily-notes-root-v74.open,.daily-compose-root-v74.open{display:flex}.daily-notes-backdrop-v74{position:absolute;inset:0;border:0;background:transparent}.daily-note-card-v74,.daily-compose-card-v74{position:relative;box-sizing:border-box;width:min(420px,100%);max-height:calc(100dvh - 44px);overflow:auto;padding:28px 24px 26px;border:1px solid color-mix(in srgb,var(--chat-border) 80%,white);border-radius:30px;background:color-mix(in srgb,var(--chat-surface) 94%,#fff);box-shadow:0 22px 54px rgba(57,43,35,.2)}.daily-note-close-v74{position:absolute;top:14px;right:14px;display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;background:var(--accent-pale);color:var(--chat-accent);font:27px/1 var(--font-b);cursor:pointer}.daily-note-person-v74{display:grid;justify-items:center;gap:7px;padding:14px 48px 21px}.daily-note-avatar-v74{display:grid;place-items:center;width:86px;height:86px;overflow:hidden;border:4px solid var(--chat-surface);border-radius:50%;background:var(--accent-pale);box-shadow:0 5px 18px color-mix(in srgb,var(--chat-accent) 18%,transparent)}.daily-note-avatar-v74 img,.daily-note-avatar-v74 svg{width:100%;height:100%;object-fit:cover}.daily-note-avatar-v74 svg{width:52%;height:52%;fill:none;stroke:var(--chat-accent);stroke-width:1.7}.daily-note-person-v74 strong{color:var(--chat-text);font:400 24px/1.2 var(--font-d)}.daily-note-person-v74 time{color:var(--chat-muted);font:11px var(--font-b)}.daily-note-paper-v74{min-height:185px;padding:20px;border-radius:23px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent-pale) 72%,white),color-mix(in srgb,#fff 92%,var(--accent-pale)));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent-light) 58%,transparent)}.daily-note-paper-v74 small{display:block;margin-bottom:14px;color:var(--chat-accent);font:400 17px var(--font-d);letter-spacing:.06em}.daily-note-paper-v74 p{margin:0;color:var(--chat-text);font:16px/1.9 var(--font-b);white-space:pre-wrap;word-break:break-word}.daily-compose-card-v74 h2{margin:3px 0 18px;color:var(--chat-text);font:400 25px var(--font-d)}.daily-compose-card-v74 textarea{box-sizing:border-box;width:100%;min-height:180px;padding:15px;border:1px solid var(--chat-border);border-radius:18px;resize:vertical;background:var(--accent-pale);color:var(--chat-text);font:15px/1.7 var(--font-b);outline:none}.daily-compose-card-v74>div{display:flex;justify-content:flex-end;gap:9px;margin-top:13px}.daily-primary-v74,.daily-secondary-v74{padding:10px 16px;border-radius:999px;font:13px var(--font-b);cursor:pointer}.daily-primary-v74{border:0;background:var(--chat-accent);color:var(--accent-contrast)}.daily-secondary-v74{border:1px solid var(--chat-border);background:transparent;color:var(--chat-text)}</style>')}
const openConversationV74Base=openConversation;
openConversation=async function(id){await openConversationV74Base(id);attachDailyAddButtonV74();try{await loadDailyNotesV74()}catch(error){dailyNotesV74=[];console.warn('daily notes unavailable:',error.message)}syncDailyAvatarV74()};
function initDailyNotesV74(){injectDailyNoteStylesV74();ensureDailyNotesV74();attachDailyAddButtonV74();renderToolManagerV17()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDailyNotesV74);else initDailyNotesV74();

/* V75: refresh the tiny unread state immediately after TA finishes a reply. */
const revealAiMessagesV75Base=revealAiMessages;
revealAiMessages=async function(aiMessages,baseMessages){const result=await revealAiMessagesV75Base(aiMessages,baseMessages);if(current){try{await loadDailyNotesV74();syncDailyAvatarV74()}catch(error){console.warn('daily note refresh failed:',error.message)}}return result};

/* V76: Moments have separate read receipts for Iris and TA.  A note can be
   browsed without accidentally clearing the other person's unread state. */
const DAILY_NOTE_LABEL_V76='Moment';
let dailyViewerNotesV76=[],dailyViewerIndexV76=0;
const dailyReadKeyV76=author=>author==='iris'?'readByClaudeAt':'readByIrisAt';
function dailyUnreadV76(note,author){const key=dailyReadKeyV76(author);return note?.author===author&&!note?.[key]&&!(author==='claude'&&note?.readAt)}
function dailyPersonV76(author){return author==='iris'?(profile||{name:'Iris'}):dailyRoleV74()}
function ensureDailyPagerV76(){ensureDailyNotesV74();const card=$('dailyNotesRootV74')?.querySelector('.daily-note-card-v74');if(!card||card.querySelector('.daily-note-nav-v76'))return;card.querySelector('.daily-note-person-v74')?.insertAdjacentHTML('afterend','<nav class="daily-note-nav-v76" id="dailyNoteNavV76"><button type="button" data-daily-prev-v76 aria-label="上一条">‹</button><span id="dailyNoteCountV76"></span><button type="button" data-daily-next-v76 aria-label="下一条">›</button></nav>');card.querySelector('[data-daily-prev-v76]').onclick=()=>{dailyViewerIndexV76=(dailyViewerIndexV76-1+dailyViewerNotesV76.length)%dailyViewerNotesV76.length;paintDailyViewerV76()};card.querySelector('[data-daily-next-v76]').onclick=()=>{dailyViewerIndexV76=(dailyViewerIndexV76+1)%dailyViewerNotesV76.length;paintDailyViewerV76()}}
function paintDailyViewerV76(){const note=dailyViewerNotesV76[dailyViewerIndexV76];if(!note)return;const person=dailyPersonV76(note.author);$('dailyNoteAvatarV74').innerHTML=note.author==='iris'?irisAvatar():roleAvatar(person);$('dailyNoteNameV74').textContent=person?.name||(note.author==='iris'?'Iris':'TA');$('dailyNoteTimeV74').textContent=dailyDateV74(note.createdAt);$('dailyNoteLabelV74').textContent=DAILY_NOTE_LABEL_V76;$('dailyNoteContentV74').textContent=note.content||'还没有留下 Moment。';const nav=$('dailyNoteNavV76'),count=$('dailyNoteCountV76');if(nav){nav.hidden=dailyViewerNotesV76.length<2;if(count)count.textContent=`${dailyViewerIndexV76+1} / ${dailyViewerNotesV76.length}`}}
openDailyViewerV74=async function(note){const role=dailyRoleV74();if(!role||!note)return;ensureDailyPagerV76();dailyViewerNotesV76=dailyNotesV74.filter(item=>item.author===note.author).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));dailyViewerIndexV76=Math.max(0,dailyViewerNotesV76.findIndex(item=>item.id===note.id));paintDailyViewerV76();const root=$('dailyNotesRootV74');root.classList.add('open');root.setAttribute('aria-hidden','false');if(note.author==='claude'&&dailyNotesV74.some(item=>dailyUnreadV76(item,'claude'))){try{await api('/api/chat/daily-notes/read',{method:'POST',body:JSON.stringify({roleId:role.id,reader:'iris'})});const now=new Date().toISOString();dailyNotesV74=dailyNotesV74.map(item=>item.author==='claude'?{...item,readByIrisAt:now,readAt:now}:item);dailyViewerNotesV76=dailyNotesV74.filter(item=>item.author==='claude').sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));paintDailyViewerV76();syncDailyAvatarV74()}catch(error){console.warn('daily note read state failed:',error.message)}}};
function decorateDailyAvatarV76(target,author,unread){if(!target)return;target.classList.toggle('has-daily-note-v74',unread);target.classList.toggle('daily-unread-v76',unread);target.tabIndex=0;target.setAttribute('role','button');target.setAttribute('aria-label',unread?'查看未读 Moment':'查看 Moment');const open=()=>openDailyViewerV74(dailyNotesV74.find(note=>dailyUnreadV76(note,author))||dailyNotesV74.find(note=>note.author===author));target.onclick=open;target.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}}
function syncDailyAvatarV76(){const claudeUnread=dailyNotesV74.some(note=>dailyUnreadV76(note,'claude')),irisUnread=dailyNotesV74.some(note=>dailyUnreadV76(note,'iris'));decorateDailyAvatarV76($('chatTitle')?.querySelector('.chat-title-role-avatar'),'claude',claudeUnread);document.querySelectorAll('.message-group.assistant .avatar-stack .avatar').forEach(avatar=>decorateDailyAvatarV76(avatar,'claude',claudeUnread));document.querySelectorAll('.message-group.user .avatar-stack .avatar').forEach(avatar=>decorateDailyAvatarV76(avatar,'iris',irisUnread))}
syncDailyAvatarV74=syncDailyAvatarV76;
const renderMessagesV76Base=renderMessages;
renderMessages=function(){const result=renderMessagesV76Base();syncDailyAvatarV76();return result};
function refreshDailyAddIconV76(){const button=document.querySelector('[data-add-daily-v74]');if(!button)return;const icon=button.querySelector('.daily-add-icon-v74');if(icon)icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c.9 4.7 3.3 7.1 8 8.5-4.7.9-7.1 3.3-8.5 8-1-4.6-3.4-7-8-8 4.6-1 7-3.4 8.5-8.5Z"/></svg>';button.querySelector('span').textContent='Moment'}
function injectDailyMomentStylesV76(){if($('dailyMomentStylesV76'))return;document.head.insertAdjacentHTML('beforeend','<style id="dailyMomentStylesV76">.daily-add-icon-v74{display:grid!important;place-items:center;background:var(--chat-surface)!important;color:var(--chat-accent)!important;font:inherit!important}.daily-add-icon-v74 svg{width:29px;height:29px;fill:currentColor}.daily-note-nav-v76{display:flex;align-items:center;justify-content:center;gap:14px;margin:-10px 0 15px;color:var(--chat-muted);font:12px var(--font-b)}.daily-note-nav-v76[hidden]{display:none}.daily-note-nav-v76 button{display:grid;place-items:center;width:27px;height:27px;padding:0;border:1px solid var(--chat-border);border-radius:50%;background:var(--chat-surface);color:var(--chat-accent);font:22px/1 var(--font-b);cursor:pointer}.avatar.daily-unread-v76{overflow:visible!important;isolation:isolate}.avatar.daily-unread-v76:before{content:"";position:absolute;z-index:-1;inset:-5px;border-radius:50%;background:conic-gradient(#ff9eb5,#ffd66d,#84d7cd,#9f9bff,#ff9eb5);animation:dailyRainbowV74 3.4s linear infinite}.avatar.daily-unread-v76:after{content:"";position:absolute;z-index:-1;inset:-2px;border-radius:50%;background:var(--chat-bg,#f5f5f5)}.avatar.daily-unread-v76 img,.avatar.daily-unread-v76 svg{border-radius:50%}</style>')}
function initDailyMomentV76(){DAILY_NOTE_LABEL_V74;injectDailyMomentStylesV76();ensureDailyPagerV76();refreshDailyAddIconV76();$('dailyPublishV74').onclick=publishDailyNoteV74;syncDailyAvatarV76()}
const attachDailyAddButtonV76Base=attachDailyAddButtonV74;
attachDailyAddButtonV74=function(){attachDailyAddButtonV76Base();refreshDailyAddIconV76()};
const publishDailyNoteV76Base=publishDailyNoteV74;
publishDailyNoteV74=async function(){const result=await publishDailyNoteV76Base();syncDailyAvatarV76();return result};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDailyMomentV76);else initDailyMomentV76();

/* V77: the first rainbow-ring draft used an unpositioned pseudo element,
   which could become viewport-sized on mobile.  Keep the ring inside the
   avatar's fixed box instead.  The room header remains deliberately plain. */
function syncDailyAvatarV77(){const claudeUnread=dailyNotesV74.some(note=>dailyUnreadV76(note,'claude')),irisUnread=dailyNotesV74.some(note=>dailyUnreadV76(note,'iris'));const titleAvatar=$('chatTitle')?.querySelector('.chat-title-role-avatar');if(titleAvatar){titleAvatar.classList.remove('has-daily-note-v74','daily-unread-v76');titleAvatar.removeAttribute('role');titleAvatar.removeAttribute('tabindex');titleAvatar.removeAttribute('aria-label');titleAvatar.onclick=null;titleAvatar.onkeydown=null}document.querySelectorAll('.message-group.assistant .avatar-stack .avatar').forEach(avatar=>decorateDailyAvatarV76(avatar,'claude',claudeUnread));document.querySelectorAll('.message-group.user .avatar-stack .avatar').forEach(avatar=>decorateDailyAvatarV76(avatar,'iris',irisUnread))}
syncDailyAvatarV74=syncDailyAvatarV77;
function injectDailyRingFixV77(){if($('dailyRingFixV77'))return;document.head.insertAdjacentHTML('beforeend','<style id="dailyRingFixV77">html,body{overflow-x:hidden!important}.avatar.daily-unread-v76{position:relative!important;z-index:0;overflow:hidden!important;box-sizing:border-box!important;padding:3px!important;border:0!important;border-radius:50%!important;background:conic-gradient(#ff91b0,#ffd26b,#66d8c4,#9b8cff,#ff91b0)!important;box-shadow:0 0 0 1px rgba(255,255,255,.92),0 2px 7px rgba(134,101,145,.27)}.avatar.daily-unread-v76:before,.avatar.daily-unread-v76:after{content:none!important;display:none!important}.avatar.daily-unread-v76 img,.avatar.daily-unread-v76 svg{display:block;width:100%!important;height:100%!important;border-radius:50%!important;background:var(--chat-surface)!important}</style>')}
function initDailyRingFixV77(){injectDailyRingFixV77();syncDailyAvatarV77()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDailyRingFixV77);else initDailyRingFixV77();

/* V78: reflect the server's Moment changes immediately in the same reply;
   the later background refresh remains only as a consistency fallback. */
const TURN_TOOL_NAMES_V78={...TURN_TOOL_NAMES_V23,publish_daily_note:'发布 Moment',read_moments:'查看 Moment'};
function toolCallMarkupV78(call,index){const name=String(call?.name||'unknown_tool'),label=TURN_TOOL_NAMES_V78[name]||name,failed=call?.ok===false,status=failed?'失败':'成功';return '<details class="turn-tool-row-v23"><summary class="turn-tool-row-head-v23"><div><strong>'+esc(label)+'</strong><small>'+esc(name)+'</small></div><span class="'+(failed?'failed':'success')+'">'+status+'</span><i aria-hidden="true"></i></summary><dl><div><dt>参数</dt><dd>'+esc(traceTextV23(call?.args))+'</dd></div><div><dt>结果</dt><dd>'+esc(traceTextV23(call?.result))+'</dd></div></dl></details>'}
toolCallMarkupV23=toolCallMarkupV78;
const revealAiMessagesV78Base=revealAiMessages;
revealAiMessages=async function(aiMessages,baseMessages){const created=ensureArray(aiMessages).map(message=>message?.dailyNote).filter(Boolean),readIds=new Set(ensureArray(aiMessages).flatMap(message=>ensureArray(message?.dailyNoteReadIds)));if(created.length||readIds.size){const now=new Date().toISOString();const byId=new Map(dailyNotesV74.map(note=>[String(note.id),note]));created.forEach(note=>byId.set(String(note.id),note));dailyNotesV74=[...byId.values()].map(note=>readIds.has(String(note.id))?{...note,readByClaudeAt:now}:note).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));syncDailyAvatarV77()}const result=await revealAiMessagesV78Base(aiMessages,baseMessages);syncDailyAvatarV77();return result};

/* V83: replies that have visibly finished rendering in the chat are read.
   Persist that acknowledgement immediately so leaving for another PWA page
   cannot replay the already-read bubbles as notifications. */
const revealAiMessagesV83Base=revealAiMessages;
revealAiMessages=async function(aiMessages,baseMessages){const result=await revealAiMessagesV83Base(aiMessages,baseMessages);const messages=ensureArray(aiMessages);for(let index=messages.length-1;index>=0;index-=1){const message=messages[index];if(message?.role==='claude'&&message?.id&&message?.createdAt){window.IrisPwaNotifications?.markMessageSeen?.(message);break}}return result};
function injectDailyOuterRingV78(){if($('dailyOuterRingV78'))return;document.head.insertAdjacentHTML('beforeend','<style id="dailyOuterRingV78">.avatar.daily-unread-v76{position:relative!important;z-index:0!important;isolation:isolate!important;overflow:visible!important;padding:0!important;border:1px solid var(--accent-light)!important;background:var(--accent-pale)!important;box-shadow:none!important}.avatar-stack:has(.avatar.daily-unread-v76){gap:6px!important}.avatar.daily-unread-v76:before{content:""!important;display:block!important;position:absolute!important;z-index:-1!important;inset:-2px!important;border-radius:50%!important;background:conic-gradient(#ff91b0,#ffd26b,#66d8c4,#9b8cff,#ff91b0)!important;animation:dailyRainbowV74 3.4s linear infinite!important}.avatar.daily-unread-v76:after{content:""!important;display:block!important;position:absolute!important;z-index:-1!important;inset:0!important;border-radius:50%!important;background:var(--chat-bg)!important}.avatar.daily-unread-v76 img,.avatar.daily-unread-v76 svg{width:100%!important;height:100%!important;border-radius:inherit!important;background:var(--chat-surface)!important}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectDailyOuterRingV78);else injectDailyOuterRingV78();

/* V81: an unmerged reply renders each visual item as a separate row.  Keep
   the per-turn tool/thinking controls on the first row instead of dropping
   them when that alternate renderer takes over. */
function avatarRowV81(message,role,markup,showInsights){const user=message.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(message.createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',insights=!user&&showInsights?turnInsightButtonsV23(message):'',stack='<div class="bubble-stack">'+insights+markup+'</div>';return '<div class="message-group '+(user?'user':'assistant')+' message-piece-v72">'+(user?stack+person:person+stack)+'</div>'}
const renderGroupV81Base=renderGroup;
renderGroup=function(group,role){if(current?.mergeBubbles!==false||group?.isSystem||group?.messages?.[0]?.transfer||group?.messages?.[0]?.companionInvitation||group?.messages?.[0]?.companionCompletion||group?.messages?.[0]?.systemType==='companion_completion')return renderGroupV81Base(group,role);return group.messages.flatMap((message,index)=>splitMessagePiecesV73(message,index).map((markup,pieceIndex)=>avatarRowV81(message,role,markup,pieceIndex===0))).join('')};

// The new reader is paired with Moment publishing.  Old role configs that
// already had publishing checked should show the effective permission too.
const toolConfigV81Base=toolConfigV17;
toolConfigV17=function(value){const config=toolConfigV81Base(value);if(config.mode!=='all'&&config.allowed.includes('publish_daily_note')&&!config.allowed.includes('read_moments'))config.allowed=[...config.allowed,'read_moments'];return config};
const dailyToolsV81=TOOL_GROUPS_V17.find(group=>group[0]==='日常');
if(dailyToolsV81&&!dailyToolsV81[1].includes('read_moments')){dailyToolsV81[1].push('read_moments');dailyToolsV81[2].push('查看 Moment 历史')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>renderToolManagerV17?.());else renderToolManagerV17?.();

/* V86: an accepted invitation stays in the chat as the explicit recovery
   entrance.  Never redirect on later visits to this conversation. */
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-listening-details]');if(!button)return;const message=messages.find(item=>String(item.id)===String(button.dataset.listeningDetails)),detail=message?.listeningCompletion;if(!detail)return;document.querySelector('.listening-detail-v86')?.remove();const tracks=(detail.tracks||[]).map(track=>'<p>♫ '+esc(track.songName)+' · '+esc(track.artistName)+'</p>').join('')||'<p>本次没有播放歌曲。</p>',chat=(detail.chat||[]).map(item=>'<p><b>'+esc(item.role==='iris'?'Iris':'TA')+'：</b>'+esc(item.content)+'</p>').join('')||'<p>本次没有房间聊天。</p>';document.body.insertAdjacentHTML('beforeend','<section class="listening-detail-v86"><article><button aria-label="关闭">×</button><h3>一起听详情</h3><p>陪伴时长：'+esc(listeningDurationV85(detail.playedSeconds))+'</p><h4>听过的歌</h4>'+tracks+'<h4>房间聊天</h4>'+chat+'</article></section>');document.querySelector('.listening-detail-v86').onclick=e=>{if(e.target===e.currentTarget||e.target.closest('button'))e.currentTarget.remove()}});

/* V87: the listening completion detail follows the companion sheet pattern:
   it rises from the bottom and retains the room's duration, music and chat. */
function openListeningDetailV87(messageId){const message=messages.find(item=>String(item.id)===String(messageId)),detail=message?.listeningCompletion;if(!detail)return;document.querySelector('.listening-detail-v87')?.remove();const tracks=(detail.tracks||[]).map(track=>'<li><b>'+esc(track.songName)+'</b><span>'+esc(track.artistName)+'</span></li>').join('')||'<p class="empty">本次没有播放歌曲。</p>',chat=(detail.chat||[]).map(item=>'<li><b>'+esc(item.role==='iris'?'Iris':'TA')+'</b><span>'+esc(item.content)+'</span></li>').join('')||'<p class="empty">本次没有房间聊天。</p>';document.body.insertAdjacentHTML('beforeend','<section class="listening-detail-v87" role="dialog" aria-modal="true"><article><header><h3>陪伴详情</h3><button type="button" aria-label="关闭">×</button></header><p class="listening-detail-duration-v87">一起听了 '+esc(listeningDurationV85(detail.playedSeconds))+'</p><section><h4>听过的歌</h4><ul>'+tracks+'</ul></section><section><h4>陪伴聊天记录</h4><ul>'+chat+'</ul></section></article></section>');const sheet=document.querySelector('.listening-detail-v87');sheet.onclick=event=>{if(event.target===sheet||event.target.closest('button'))sheet.remove()}}
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-listening-details]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();openListeningDetailV87(button.dataset.listeningDetails)},true);
function injectListeningDetailV87Styles(){if($('listeningDetailStylesV87'))return;document.head.insertAdjacentHTML('beforeend','<style id="listeningDetailStylesV87">.listening-completion-card-v85 hr{height:1px;margin:10px 0 0;border:0;background:color-mix(in srgb,var(--chat-text) 13%,transparent)}.listening-completion-card-v85 p{margin:9px 0 0}.listening-detail-v87{position:fixed;z-index:700;inset:0;display:flex;align-items:flex-end;background:rgba(0,0,0,.42);backdrop-filter:blur(5px)}.listening-detail-v87 article{box-sizing:border-box;width:100%;max-height:78dvh;overflow:auto;padding:18px 20px calc(28px + env(safe-area-inset-bottom));border-radius:26px 26px 0 0;background:var(--chat-surface);color:var(--chat-text);box-shadow:0 -12px 35px rgba(0,0,0,.17)}.listening-detail-v87 header{display:flex;align-items:center;justify-content:space-between;padding-bottom:13px;border-bottom:1px solid var(--chat-border)}.listening-detail-v87 h3{margin:0;font:400 24px var(--font-d)}.listening-detail-v87 header button{width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:var(--chat-muted);font-size:27px;line-height:1;cursor:pointer}.listening-detail-duration-v87{margin:15px 0 4px;color:var(--chat-text);font:15px/1.55 var(--font-b)}.listening-detail-v87 section{margin-top:20px}.listening-detail-v87 h4{margin:0 0 9px;font:600 14px var(--font-b)}.listening-detail-v87 ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.listening-detail-v87 li{padding:10px 11px;border-radius:12px;background:color-mix(in srgb,var(--chat-bg) 72%,var(--chat-border));font:13px/1.55 var(--font-b)}.listening-detail-v87 li b{display:block;margin-bottom:2px}.listening-detail-v87 li span{display:block;color:var(--chat-muted)}.listening-detail-v87 .empty{margin:0;color:var(--chat-muted);font-size:13px}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectListeningDetailV87Styles);else injectListeningDetailV87Styles();

/* V82: in-app reply reminder controls live with the other left-drawer
   management entries. Each-bubble banners are paced in the open PWA. */
const NOTIFICATION_BELL_V82='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
let notificationSettingsV82={enabled:false,mode:'combined',bubbleIntervalSeconds:2};
function notificationPanelV82(){if($('panel-notifications'))return;$('panel-archive')?.insertAdjacentHTML('afterend','<div class="panel" id="panel-notifications"><div class="card notification-card-v82"><h3>消息通知</h3><p class="notification-copy-v82">PWA 保持打开时，TA 回复完成后会在首页、更多等站内页面顶部提醒。点击提醒即可回到对应聊天。</p><label class="setting-row"><span>通知总开关</span><input class="switch" id="notificationEnabledV82" type="checkbox"></label><div id="notificationOptionsV82"><div class="field"><label>通知方式</label><select id="notificationModeV82"><option value="combined">整轮回复合成一条（默认）</option><option value="each">逐条气泡通知</option></select></div><div class="field" id="notificationIntervalRowV82"><label>逐条发送间隔</label><select id="notificationIntervalV82"><option value="1">每 1 秒一条</option><option value="2">每 2 秒一条</option><option value="3">每 3 秒一条</option><option value="5">每 5 秒一条</option></select><small>模拟 TA 连续发送消息；多气泡回复会依次提醒。</small></div></div></div></div>');}
function notificationStylesV82(){if($('notificationStylesV82'))return;document.head.insertAdjacentHTML('beforeend','<style id="notificationStylesV82">.notification-card-v82{max-width:570px}.notification-copy-v82{margin:-2px 0 16px;color:var(--chat-muted);font-size:12px;line-height:1.65}.notification-card-v82 small{display:block;margin-top:6px;color:var(--chat-muted);font-size:11px;line-height:1.55}.notification-card-v82 select{box-sizing:border-box;width:100%;padding:10px 11px;border:1px solid var(--chat-border);border-radius:10px;background:var(--chat-bg);color:var(--chat-text);font-family:var(--font-b)}</style>')}
function paintNotificationSettingsV82(){const enabled=!!notificationSettingsV82.enabled,mode=notificationSettingsV82.mode==='each'?'each':'combined';$('notificationEnabledV82').checked=enabled;$('notificationModeV82').value=mode;$('notificationIntervalV82').value=String(notificationSettingsV82.bubbleIntervalSeconds||2);$('notificationOptionsV82').hidden=!enabled;$('notificationIntervalRowV82').hidden=mode!=='each'}
async function saveNotificationSettingsV82(next){const result=await api('/api/chat/notifications',{method:'PUT',body:JSON.stringify(next)});notificationSettingsV82=result.settings||notificationSettingsV82;paintNotificationSettingsV82();return notificationSettingsV82}
async function renderNotificationSettingsV82(){notificationPanelV82();try{const data=await api('/api/chat/notifications');notificationSettingsV82=data.settings||notificationSettingsV82;paintNotificationSettingsV82()}catch(error){toast(error.message||'读取通知设置失败','error')}}
function bindNotificationSettingsV82(){notificationPanelV82();$('notificationEnabledV82').onchange=async event=>{const enabled=event.target.checked;try{await saveNotificationSettingsV82({...notificationSettingsV82,enabled});toast(enabled?'站内消息提醒已开启':'站内消息提醒已关闭','success')}catch(error){notificationSettingsV82={...notificationSettingsV82,enabled:!enabled};paintNotificationSettingsV82();toast(error.message||'保存失败','error')}};$('notificationModeV82').onchange=async event=>{try{await saveNotificationSettingsV82({...notificationSettingsV82,mode:event.target.value})}catch(error){paintNotificationSettingsV82();toast('保存失败：'+error.message,'error')}};$('notificationIntervalV82').onchange=async event=>{try{await saveNotificationSettingsV82({...notificationSettingsV82,bubbleIntervalSeconds:Number(event.target.value)})}catch(error){paintNotificationSettingsV82();toast('保存失败：'+error.message,'error')}}}
function installNotificationEntryV82(){const nav=document.querySelector('#leftDrawer .nav-grid');if(!nav)return;let button=nav.querySelector('[data-panel="notifications"]');if(!button){button=document.createElement('button');button.type='button';button.className='nav-action';button.dataset.panel='notifications';nav.appendChild(button)}button.innerHTML=NOTIFICATION_BELL_V82+'通知';button.onclick=()=>openNotificationPanelV82()}
function openNotificationPanelV82(){closeDrawers();notificationPanelV82();document.body.classList.add('workspace-open');$('workspace').classList.add('open');document.querySelectorAll('.panel').forEach(panel=>panel.classList.remove('active'));$('panel-notifications').classList.add('active');$('workspaceTitle').textContent='通知';renderNotificationSettingsV82()}
function initNotificationsV82(){notificationStylesV82();notificationPanelV82();installNotificationEntryV82();bindNotificationSettingsV82()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initNotificationsV82);else initNotificationsV82();

/* V84: together-listening cards share the same durable invitation pattern as
   companion rooms, but keep music controls inside the dedicated room. */
function listeningIconV84(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>'}
function listeningCardV84(message){const item=message.listeningInvitation||{},outgoing=item.from==='iris',status=item.status||'pending',ended=item.roomStatus==='ended',name=esc(companionRoleNameV34()),title=outgoing?'我邀请 '+name+' 一起听歌':name+' 想邀请我一起听歌';let action='';if(status==='pending'&&outgoing)action='<span class="listening-card-status-v84">等待 TA 回复</span>';else if(status==='pending')action='<div class="listening-card-actions-v84"><button data-listening-accept="'+esc(String(message.id||''))+'">同意</button><button class="quiet" data-listening-decline="'+esc(String(message.id||''))+'">拒绝</button></div>';else if(status==='accepted'&&ended)action='<span class="listening-card-status-v84">已结束</span>';else if(status==='accepted')action='<div class="listening-card-actions-v84"><span class="listening-card-status-v84">已同意</span><button data-listening-enter="'+esc(String(message.id||''))+'">进入一起听</button></div>';else action='<span class="listening-card-status-v84">已拒绝</span>';return '<article class="listening-card-v84"><header><i>'+listeningIconV84()+'</i><span>TOGETHER · LISTENING</span></header><strong>'+title+'</strong>'+action+'</article>'}
function renderListeningInvitationV84(group,role){const message=group.messages[0],user=group.role==='iris',avatar=user?irisAvatar():roleAvatar(role),time=messageTime(message.createdAt),person='<div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div>',card='<div class="bubble-stack listening-card-stack-v84">'+listeningCardV84(message)+'</div>';return '<div class="message-group listening-invitation-message-v84 '+(user?'user':'assistant')+'">'+(user?card+person:person+card)+'</div>'}
const renderGroupV84Base=renderGroup;
renderGroup=function(group,role){return group?.messages?.[0]?.listeningInvitation?renderListeningInvitationV84(group,role):renderGroupV84Base(group,role)};
function injectListeningChatStylesV84(){if($('listeningChatStylesV84'))return;document.head.insertAdjacentHTML('beforeend','<style id="listeningChatStylesV84">.listening-card-stack-v84{width:min(276px,78vw)!important;max-width:min(276px,78vw)!important}.listening-card-v84{box-sizing:border-box;width:100%;overflow:hidden;padding:15px 17px 13px;border:1px solid color-mix(in srgb,#b8a7d9 70%,var(--chat-border));border-radius:17px;background:linear-gradient(135deg,#eee9f8,#e0edf0);color:var(--chat-text);box-shadow:var(--shadow-xs)}.listening-card-v84 header{display:flex;align-items:center;gap:8px;color:var(--chat-muted)}.listening-card-v84 header i{display:grid;place-items:center;width:25px;height:25px;color:#8875a8}.listening-card-v84 header svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.listening-card-v84 header span{font:10px var(--font-b);letter-spacing:.09em}.listening-card-v84 strong{display:block;margin:9px 0 0;font:400 18px/1.35 var(--font-d)}.listening-card-status-v84{display:block;margin-top:10px;padding-top:9px;border-top:1px solid color-mix(in srgb,var(--chat-text) 13%,transparent);color:var(--chat-muted);font:12px var(--font-b)}.listening-card-actions-v84{display:flex;gap:8px;margin-top:12px}.listening-card-actions-v84 button{flex:1;padding:8px;border:0;border-radius:9px;background:#8875a8;color:#fff;font:13px var(--font-b);cursor:pointer}.listening-card-actions-v84 .quiet{border:1px solid color-mix(in srgb,var(--chat-text) 18%,transparent);background:transparent;color:var(--chat-text)}.listening-card-actions-v84 .listening-card-status-v84{flex:1;margin:0;padding:8px 3px;border:0;text-align:center}.listening-add-icon-v84 svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}</style>')}
async function sendListeningInvitationV84(){if(!current)return toast('请先进入一个聊天房间','error');try{const saved=await api('/api/chat/listening-invitations',{method:'POST',body:JSON.stringify({conversationId:current.id})});messages.push(saved);pendingTurnGroupId=saved.replyGroupId;renderMessages();scrollBottom();toast('一起听邀请已发送，等你下一次发送消息时 TA 再回应','success')}catch(error){toast(error.message||'发送邀请失败','error')}}
async function respondListeningInvitationV84(messageId,decision){if(!current)return;try{const result=await api('/api/chat/listening-invitations/'+encodeURIComponent(messageId)+'/respond',{method:'POST',body:JSON.stringify({conversationId:current.id,decision})});const index=messages.findIndex(message=>String(message.id)===String(messageId));if(index>=0)messages[index]=result.invitation;if(result.systemMessage)messages.push(result.systemMessage);renderMessages();if(decision==='accept'&&result.room?.id)location.href='listening.html?room='+encodeURIComponent(result.room.id)}catch(error){toast(error.message||'处理邀请失败','error')}}
async function enterListeningInvitationV84(messageId){if(!current)return;try{const result=await api('/api/chat/listening-invitations/'+encodeURIComponent(messageId)+'/enter',{method:'POST',body:JSON.stringify({conversationId:current.id})});location.href='listening.html?room='+encodeURIComponent(result.room.id)}catch(error){toast(error.message||'进入一起听失败','error')}}
document.addEventListener('click',event=>{const accept=event.target.closest?.('[data-listening-accept]');if(accept){respondListeningInvitationV84(accept.dataset.listeningAccept,'accept');return}const decline=event.target.closest?.('[data-listening-decline]');if(decline){respondListeningInvitationV84(decline.dataset.listeningDecline,'decline');return}const enter=event.target.closest?.('[data-listening-enter]');if(enter)enterListeningInvitationV84(enter.dataset.listeningEnter)});
const ensureTransferAddMenuV84Base=ensureTransferAddMenuV41;
ensureTransferAddMenuV41=function(){const menu=ensureTransferAddMenuV84Base();const grid=menu?.querySelector('.transfer-add-grid-v41');if(grid&&!grid.querySelector('[data-add-listening-v84]')){grid.insertAdjacentHTML('beforeend','<button type="button" data-add-listening-v84><i class="listening-add-icon-v84">'+listeningIconV84()+'</i><span>一起听</span></button>');grid.querySelector('[data-add-listening-v84]').onclick=()=>{closeAddTrayV57?.();sendListeningInvitationV84()}}return menu};
function initListeningChatV84(){injectListeningChatStylesV84();ensureTransferAddMenuV41()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initListeningChatV84);else initListeningChatV84();

/* V85: a finished listening room becomes a compact, durable completion card
   in the original chat instead of a raw system-text message. */
function listeningDurationV85(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);return hours?hours+' 小时 '+minutes+' 分钟':minutes+' 分钟'}
function listeningCompletionCardV85(group,role){const message=group.messages[0],item=message.listeningCompletion||{},avatar=roleAvatar(role),time=messageTime(message.createdAt);return '<div class="message-group listening-completion-message-v85 assistant"><div class="avatar-stack"><div class="avatar">'+avatar+'</div><time class="avatar-time">'+esc(time)+'</time></div><div class="bubble-stack"><article class="listening-completion-card-v85"><span>TOGETHER · LISTENING</span><strong>一起听已结束</strong><p>一起听了 '+esc(listeningDurationV85(item.playedSeconds))+'</p><hr><button data-listening-details="'+esc(String(message.id||''))+'">陪伴详情</button></article></div></div>'}
const renderGroupV85Base=renderGroup;
renderGroup=function(group,role){return group?.messages?.[0]?.listeningCompletion?listeningCompletionCardV85(group,role):renderGroupV85Base(group,role)};
function injectListeningCompletionStylesV85(){if($('listeningCompletionStylesV85'))return;document.head.insertAdjacentHTML('beforeend','<style id="listeningCompletionStylesV85">.listening-completion-card-v85{width:min(276px,78vw);box-sizing:border-box;padding:15px 17px;border:1px solid color-mix(in srgb,#b8a7d9 70%,var(--chat-border));border-radius:17px;background:linear-gradient(135deg,#eee9f8,#e0edf0);box-shadow:var(--shadow-xs)}.listening-completion-card-v85>span{color:#8875a8;font:10px var(--font-b);letter-spacing:.09em}.listening-completion-card-v85 strong{display:block;margin:8px 0 4px;font:400 18px var(--font-d)}.listening-completion-card-v85 p{margin:0;color:var(--chat-muted);font:12px/1.5 var(--font-b)}.listening-completion-card-v85 small{display:block;margin-top:8px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--chat-text) 13%,transparent);color:var(--chat-muted);font:12px var(--font-b)}.listening-completion-card-v85 button{display:block;margin-top:10px;border:0;background:transparent;color:#8875a8;font:13px var(--font-b);padding:0;cursor:pointer}.listening-detail-v86{position:fixed;z-index:600;inset:0;padding:10vh 18px;background:rgba(0,0,0,.35);overflow:auto}.listening-detail-v86 article{max-width:430px;margin:auto;padding:20px;border-radius:20px;background:var(--chat-surface);color:var(--chat-text)}.listening-detail-v86 h3{margin:0 0 12px}.listening-detail-v86 h4{margin:16px 0 7px}.listening-detail-v86 p{margin:6px 0;font-size:13px;line-height:1.55}.listening-detail-v86 button{float:right;border:0;background:transparent;font-size:24px;color:var(--chat-text)}</style>')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectListeningCompletionStylesV85);else injectListeningCompletionStylesV85();

// V88: each listening action is deliberately an independent model tool.  The
// role drawer mirrors that separation, so the model never has to guess an
// action field or mistake an outstanding invitation for a request to send one.
const LISTENING_TOOL_NAMES_V88=['send_listening_invitation','respond_listening_invitation','search_and_add_listening_song','next_listening_song','previous_listening_song','pause_listening_room','resume_listening_room'];
const LISTENING_TOOL_LABELS_V88=['主动发一起听邀请','回应一起听邀请','搜索并加入歌曲','下一首','上一首','暂停一起听','继续播放'];
const listeningToolGroupV88=TOOL_GROUPS_V17.find(group=>group[0]==='一起听');
if(listeningToolGroupV88){listeningToolGroupV88[1]=[...LISTENING_TOOL_NAMES_V88];listeningToolGroupV88[2]=[...LISTENING_TOOL_LABELS_V88]}
else TOOL_GROUPS_V17.push(['一起听',[...LISTENING_TOOL_NAMES_V88],[...LISTENING_TOOL_LABELS_V88]]);
const toolConfigV85Base=toolConfigV17;
toolConfigV17=function(value){const config=toolConfigV85Base(value);if(config.mode!=='all'){const ver=Number(value?.version||0);const legacy=config.allowed.includes('manage_listening_room');config.allowed=config.allowed.filter(name=>name!=='manage_listening_room');if(legacy||(ver<5&&!LISTENING_TOOL_NAMES_V88.some(name=>config.allowed.includes(name))))config.allowed=[...new Set([...config.allowed,...LISTENING_TOOL_NAMES_V88])]}return config};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>renderToolManagerV17?.());else renderToolManagerV17?.();

/* V80: API / Agent per-conversation mode toggle.  Inserted above the model
   picker in the right sidebar.  In Agent mode the API model picker hides and
   the relay routes through Claude Code CLI instead. */
const MODE_ICON_V80='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
function injectModeToggleStylesV80(){if($('modeToggleStylesV80'))return;document.head.insertAdjacentHTML('beforeend','<style id="modeToggleStylesV80">.right-menu-mode-v80{padding:8px 0 6px;margin-bottom:2px}.right-menu-mode-label-v80{display:flex;align-items:center;gap:10px;margin:0 4px 8px;color:var(--chat-muted);font-size:12px}.right-menu-mode-label-v80 .right-menu-icon{display:flex;align-items:center}.mode-segmented-v80{display:flex;width:100%;border-radius:10px;overflow:hidden;border:1px solid var(--chat-border);background:var(--chat-bg)}.mode-segmented-v80 button{flex:1;padding:8px 0;border:0;background:transparent;color:var(--chat-muted);font:13px var(--font-b);cursor:pointer;transition:background .15s,color .15s}.mode-segmented-v80 button.active{background:var(--chat-accent);color:var(--accent-contrast)}.right-model-hint-v80{margin:0 0 8px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--chat-accent) 10%,var(--chat-bg));color:var(--chat-muted);font:12px/1.5 var(--font-b);text-align:center}</style>')}
function ensureModeToggleV80(){const root=$('rightSettingsMenuV12');if(!root||$('modeToggleV80'))return;const modelSection=root.querySelector('.right-menu-model');if(!modelSection)return;const section=document.createElement('section');section.className='right-menu-mode-v80';section.id='modeToggleV80';section.innerHTML='<div class="right-menu-mode-label-v80"><span class="right-menu-icon">'+MODE_ICON_V80+'</span><span>对话模式</span></div><div class="mode-segmented-v80" id="modeSegmentedV80"><button type="button" data-mode="api">API</button><button type="button" data-mode="agent">Agent</button></div>';root.insertBefore(section,modelSection);section.querySelectorAll('[data-mode]').forEach(btn=>{btn.onclick=()=>switchModeV80(btn.dataset.mode)})}
async function switchModeV80(mode){if(!current)return;const next=mode==='agent'?'agent':'api';if((current.mode||'api')===next)return;try{await updateConversation(current.id,{mode:next});current.mode=next;hydrateModeToggleV80();renderToolManagerV17();toast(next==='agent'?'已切换到 Agent 模式':'已切换到 API 模式','success')}catch(error){toast('切换模式失败：'+error.message,'error')}}
function hydrateModeToggleV80(){ensureModeToggleV80();const mode=(current?.mode||'api');const seg=$('modeSegmentedV80');if(seg)seg.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));setModelPickerLabelV12()}
function presetsForModeV80(){const mode=(current?.mode||'api');const all=settings.presets||[];return mode==='agent'?all.filter(p=>p.provider==='cc'):all.filter(p=>p.provider!=='cc')}
const openModelSheetV12Base=openModelSheetV12;
openModelSheetV12=function(presetId){ensureModelSheetV12();const filtered=presetsForModeV80(),sheet=$('rightModelSheetV12'),title=$('rightModelSheetTitle'),list=$('rightModelSheetListV12'),isAgent=(current?.mode||'api')==='agent';sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');if(!presetId){title.textContent=isAgent?'选择 Agent 模型':'选择模型预设';const follow=isAgent?'':'<button type="button" class="right-model-follow" data-model-follow>跟随主模型 <span>›</span></button>';const hint=isAgent?'<p class="right-model-hint-v80">请选择一个模型开启对话</p>':'';list.innerHTML=hint+follow+(filtered.length?filtered.map(p=>'<button type="button" class="right-model-preset" data-model-preset="'+esc(p.id)+'"><span><strong>'+esc(p.name||'未命名预设')+'</strong><small>'+(p.models||[p.model].filter(Boolean)).length+' 个已保存模型</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>').join(''):'<p class="right-model-empty">当前模式没有可用预设，请到左侧"模型设置"创建。</p>');if(!isAgent)list.querySelector('[data-model-follow]')?.addEventListener('click',()=>chooseConversationModelV12());list.querySelectorAll('[data-model-preset]').forEach(button=>button.onclick=()=>openModelSheetV12(button.dataset.modelPreset));return}const preset=filtered.find(item=>item.id===presetId)||(settings.presets||[]).find(item=>item.id===presetId);if(!preset){openModelSheetV12();return}const models=(preset.models||[preset.model].filter(Boolean));title.textContent=preset.name||'未命名预设';list.innerHTML='<button type="button" class="right-model-follow" data-model-back>‹ 返回预设列表</button>'+(models.length?models.map(model=>'<button type="button" class="right-model-choice" data-model-value="'+esc(model)+'"><span><strong>'+esc(model)+'</strong><small>'+esc(preset.name||'当前预设')+'</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>').join(''):'<p class="right-model-empty">这个预设还没有保存模型。</p>');list.querySelector('[data-model-back]')?.addEventListener('click',()=>openModelSheetV12());list.querySelectorAll('[data-model-value]').forEach(button=>button.onclick=()=>chooseConversationModelV12(preset.id,button.dataset.modelValue))};
const hydrateRightV80Base=hydrateRight;
hydrateRight=function(){hydrateRightV80Base();hydrateModeToggleV80()};
function initModeToggleV80(){injectModeToggleStylesV80();ensureModeToggleV80()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initModeToggleV80);else initModeToggleV80();

/* V88b: Agent mode tool config — override toolConfigV17 & persistToolConfigV17
   so the tool manager shows agent defaults (memory + self-profile) when in agent
   mode, and saves agent-mode tool changes to the conversation object instead of
   the role. */
const CC_AGENT_DEFAULT_TOOLS_V88=new Set(['read_self_profile','update_self_profile','read_memories','search_memories','add_memory','update_memory','delete_memory']);
const toolConfigV88bBase=toolConfigV17;
toolConfigV17=function(value){
  if((current?.mode||'api')==='agent'){
    const agentCfg=current.agentToolConfig;
    if(agentCfg&&typeof agentCfg==='object'){
      return{enabled:agentCfg.enabled!==false,mode:'custom',allowed:Array.isArray(agentCfg.allowed)?agentCfg.allowed:[]}
    }
    /* 无保存过的 agentToolConfig → 默认只开启 agent 默认工具 */
    const base=toolConfigV88bBase(value);
    const agentAllowed=base.mode==='all'?[...CC_AGENT_DEFAULT_TOOLS_V88]:base.allowed.filter(name=>CC_AGENT_DEFAULT_TOOLS_V88.has(name));
    return{enabled:true,mode:'custom',allowed:agentAllowed}
  }
  return toolConfigV88bBase(value)
};
const persistToolConfigV88bBase=persistToolConfigV17;
persistToolConfigV17=async function(config){
  if((current?.mode||'api')==='agent'){
    try{
      const saved=await updateConversation(current.id,{agentToolConfig:config});
      current.agentToolConfig=saved.agentToolConfig||config;
      renderToolManagerV17();toast('Agent 工具设置已保存','success')
    }catch(e){toast('保存失败：'+e.message,'error')}
    return
  }
  return persistToolConfigV88bBase(config)
};

/* ═══════ Claude Code Usage / Quota Panel ═══════ */
const usageIconV90='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
let usageTimerV90=null;

function injectUsageStylesV90(){
  if($('usageStylesV90'))return;
  document.head.insertAdjacentHTML('beforeend','<style id="usageStylesV90">'+
    '.usage-panel-v90{display:grid;gap:16px;padding:4px 0}'+
    '.usage-card-v90{padding:16px;border:1px solid var(--chat-border);border-radius:14px;background:var(--chat-surface)}'+
    '.usage-card-v90 h4{margin:0 0 10px;color:var(--chat-text);font:600 15px/1.3 var(--font-b)}'+
    '.usage-bar-v90{position:relative;height:8px;border-radius:99px;background:color-mix(in srgb,var(--chat-muted) 16%,transparent);overflow:hidden}'+
    '.usage-bar-fill-v90{position:absolute;inset:0;border-radius:99px;transition:width .4s ease}'+
    '.usage-meta-v90{display:flex;justify-content:space-between;margin-top:8px;color:var(--chat-muted);font:12px/1.4 var(--font-b)}'+
    '.usage-pct-v90{font-weight:700;font-size:22px;color:var(--chat-text);margin-bottom:6px}'+
    '.usage-note-v90{margin:0;color:var(--chat-muted);font:12px/1.6 var(--font-b);text-align:center}'+
  '</style>');
}

function usageBarColor(pct){
  if(pct>=80)return '#d65c5c';
  if(pct>=50)return '#e0a548';
  return 'var(--chat-accent)';
}

function formatResetTime(iso){
  if(!iso)return '—';
  const d=new Date(iso);
  const now=new Date();
  const diffMs=d-now;
  if(diffMs<=0)return '已重置';
  const diffMin=Math.floor(diffMs/60000);
  if(diffMin<60)return diffMin+' 分钟后';
  const diffHr=Math.floor(diffMin/60);
  if(diffHr<24)return diffHr+' 小时 '+String(diffMin%60).padStart(2,'0')+' 分钟后';
  const weekdays=['日','一','二','三','四','五','六'];
  return '周'+weekdays[d.getDay()]+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

function ensureUsagePanelV90(){
  if($('panel-usage'))return;
  $('panel-archive')?.insertAdjacentHTML('afterend',
    '<div class="panel" id="panel-usage"><div class="card">'+
    '<h3>Claude Code 额度</h3>'+
    '<div id="usageContentV90"><p class="empty-note">加载中…</p></div>'+
    '</div></div>');
}

function renderUsageContentV90(data){
  const el=$('usageContentV90');
  if(!el)return;
  const fh=data.five_hour||{};
  const sd=data.seven_day||{};
  const fhPct=Math.round(fh.utilization??0);
  const sdPct=Math.round(sd.utilization??0);
  el.innerHTML=
    '<div class="usage-panel-v90">'+
      '<div class="usage-card-v90">'+
        '<h4>当前窗口</h4>'+
        '<div class="usage-pct-v90">'+fhPct+'%</div>'+
        '<div class="usage-bar-v90"><div class="usage-bar-fill-v90" style="width:'+fhPct+'%;background:'+usageBarColor(fhPct)+'"></div></div>'+
        '<div class="usage-meta-v90"><span>已使用</span><span>重置：'+esc(formatResetTime(fh.resets_at))+'</span></div>'+
      '</div>'+
      '<div class="usage-card-v90">'+
        '<h4>本周额度</h4>'+
        '<div class="usage-pct-v90">'+sdPct+'%</div>'+
        '<div class="usage-bar-v90"><div class="usage-bar-fill-v90" style="width:'+sdPct+'%;background:'+usageBarColor(sdPct)+'"></div></div>'+
        '<div class="usage-meta-v90"><span>已使用</span><span>重置：'+esc(formatResetTime(sd.resets_at))+'</span></div>'+
      '</div>'+
      '<p class="usage-note-v90">数据来自 Claude 官方，约每分钟刷新</p>'+
    '</div>';
}

async function fetchAndRenderUsageV90(){
  ensureUsagePanelV90();
  try{
    const data=await api('/api/agent/claude-usage');
    renderUsageContentV90(data);
  }catch(e){
    const el=$('usageContentV90');
    if(el)el.innerHTML='<p class="empty-note">获取失败：'+esc(e.message||'未知错误')+'</p>';
  }
}

function activateUsagePanelV90(){
  closeDrawers();
  injectUsageStylesV90();
  ensureUsagePanelV90();
  document.body.classList.add('workspace-open');
  $('workspace').classList.add('open');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  $('panel-usage').classList.add('active');
  $('workspaceTitle').textContent='额度';
  fetchAndRenderUsageV90();
  // 自动刷新：90 秒
  clearInterval(usageTimerV90);
  usageTimerV90=setInterval(()=>{
    if(!$('panel-usage')?.classList.contains('active')){clearInterval(usageTimerV90);return}
    fetchAndRenderUsageV90();
  },90000);
}

function ensureUsageEntryV90(){
  const root=$('leftSettingsMenuV14');
  if(!root||$('leftUsageEntryV90'))return;
  root.querySelector('.left-tool-shelf-v14')?.insertAdjacentHTML('beforeend',
    '<button type="button" class="left-menu-action-v14" id="leftUsageEntryV90">'+
    '<span class="left-menu-icon-v14">'+usageIconV90+'</span>额度</button>');
  $('leftUsageEntryV90').onclick=activateUsagePanelV90;
}

// 初始化：左侧栏加入"额度"按钮
{const origEnsureLeft=ensureLeftDrawerV14;ensureLeftDrawerV14=function(){origEnsureLeft.apply(this,arguments);ensureUsageEntryV90()}};
