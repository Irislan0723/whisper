/* irisandclaude · 全局初始化脚本
   处理主题切换 + 自定义预设 + 自定义字体
   所有带主题的页面在 <head> 顶部加载此文件 */
(function(){
  /* ---- Theme ---- */
  var BUILT_IN = ['blueberry','mint','chestnut'];
  var MIGRATE = {rose:'mint',sage:'mint',lake:'blueberry',lavender:'blueberry',umber:'chestnut',berry:'mint',grape:'mint',yam:'blueberry'};
  var t = localStorage.getItem('theme') || 'mint';

  // Migrate legacy names
  if (MIGRATE[t]) { t = MIGRATE[t]; localStorage.setItem('theme', t); }

  var applied = false;

  if (BUILT_IN.indexOf(t) >= 0) {
    document.documentElement.dataset.theme = t;
    applied = true;
  } else if (t === 'custom') {
    // Legacy single custom theme
    document.documentElement.dataset.theme = 'custom';
    try {
      var c = JSON.parse(localStorage.getItem('custom-theme'));
      if (c) { var s = document.documentElement.style; for (var k in c) s.setProperty('--' + k, c[k]); }
    } catch(e) {}
    applied = true;
  } else if (t.indexOf('preset-') === 0) {
    // Saved custom preset
    document.documentElement.dataset.theme = 'custom';
    try {
      var presets = JSON.parse(localStorage.getItem('iris-saved-themes')) || [];
      for (var i = 0; i < presets.length; i++) {
        if (presets[i].id === t && presets[i].vars) {
          var s = document.documentElement.style;
          for (var k in presets[i].vars) s.setProperty('--' + k, presets[i].vars[k]);
          applied = true;
          break;
        }
      }
    } catch(e) {}
  }

  if (!applied) {
    t = 'mint'; localStorage.setItem('theme', t);
    document.documentElement.dataset.theme = 'mint';
  }

  /* ---- Custom Fonts ---- */
  try {
    var fonts = JSON.parse(localStorage.getItem('iris-custom-fonts'));
    if (fonts) {
      var css = '';
      var ds = document.documentElement.style;
      var cnSrc = fonts.cn && fonts.cn.src;
      var enSrc = fonts.en && fonts.en.src;
      // If shared mode, use cn for both
      if (fonts.shared && cnSrc) { enSrc = cnSrc; }

      if (cnSrc) {
        css += '@font-face{font-family:"IrisCN";src:url("' + cnSrc + '");font-display:swap}';
        ds.setProperty('--font-cn', '"IrisCN","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif');
        ds.setProperty('--font-b', '"IrisCN","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif');
      }
      if (enSrc) {
        css += '@font-face{font-family:"IrisEN";src:url("' + enSrc + '");font-display:swap}';
        ds.setProperty('--font-en', '"IrisEN","Cormorant Garamond","Georgia",serif');
        ds.setProperty('--font-d', '"IrisEN","Cormorant Garamond","Georgia",serif');
      }
      if (css) {
        var st = document.createElement('style');
        st.textContent = css;
        document.head.appendChild(st);
      }
    }
  } catch(e) {}
})();

/* ---- Persistent in-site music shell ----
   When enabled from the listening-room menu, regular pages render inside an
   app shell while the listening document (and its audio element) stays alive. */
(function(){
  var enabled=false;
  try { var playerFlag=localStorage.getItem('listen_global_player_enabled'); enabled=playerFlag==='1'||(playerFlag===null&&localStorage.getItem('listen_global_player_hidden')!=='1'); if(enabled&&playerFlag!== '1') localStorage.setItem('listen_global_player_enabled','1'); } catch(e) {}
  var path=location.pathname||'';
  if(enabled&&window.top===window&&!/\/app\.html$/i.test(path)){
    var view=path.split('/').pop()+(location.search||'')+(location.hash||'');
    location.replace('app.html?view='+encodeURIComponent(view));
    return;
  }
  if(!/\/listening\.html$/i.test(path)) return;
  try { if(window.top!==window&&window.frameElement&&window.frameElement.id==='viewFrame') window.parent.postMessage({type:'iris-view-listening',href:location.href},location.origin); } catch(e) {}
  function fixListeningHomeIcon(){
    var link=document.querySelector('.top-bar-home'),icon=link&&link.querySelector('svg');
    if(!link||!icon) return;
    link.style.cssText+=';display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;overflow:visible';
    icon.setAttribute('width','22'); icon.setAttribute('height','22'); icon.setAttribute('fill','none');
    icon.setAttribute('stroke','currentColor'); icon.setAttribute('stroke-width','1.7');
    icon.setAttribute('stroke-linecap','round'); icon.setAttribute('stroke-linejoin','round');
    icon.style.cssText+=';display:block;box-sizing:content-box;width:22px;height:22px;overflow:visible';
  }
  function bind(){
    fixListeningHomeIcon();
    var audio=document.getElementById('audio'); if(!audio) return;
    try { localStorage.removeItem('listen_global_player_resume'); } catch(e) {}
    var last=0;
    function remember(){
      var now=Date.now(); if(now-last<750) return; last=now;
      try { if(audio.src) localStorage.setItem('listen_global_player_resume',JSON.stringify({src:audio.currentSrc||audio.src,time:Number(audio.currentTime)||0,playing:!audio.paused})); } catch(e) {}
    }
    audio.addEventListener('play',remember); audio.addEventListener('pause',remember); audio.addEventListener('timeupdate',remember); addEventListener('pagehide',remember);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();

/* ---- Together listening: inline lyric view ----
   Lyrics replace only the record area. The room header, actions, progress,
   playback controls and app navigation stay exactly where they are. */
(function(){
  if(!/\/listening\.html$/i.test(location.pathname)) return;
  var KEY='iris-memory-2024', lyricPanel=null, lyricLines=[], translationLines=[], activeLine=-1, translationVisible=false;
  function api(path, options){ options=options||{}; return fetch(path,{method:options.method||'GET',headers:{'x-api-key':KEY}}).then(function(response){ return response.json().then(function(data){ if(!response.ok) throw new Error(data.error||'请求失败'); return data; }); }); }
  function escapeHtml(value){ return String(value||'').replace(/[&<>"']/g,function(char){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]; }); }
  function parseLyrics(text){
    var rows=[]; String(text||'').split(/\r?\n/).forEach(function(raw){
      var time=null, match, clean=raw;
      var pattern=/\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g;
      while((match=pattern.exec(raw))){ if(time===null) time=Number(match[1])*60+Number(match[2]); }
      clean=raw.replace(pattern,'').trim(); if(clean) rows.push({time:time===null?-1:time,text:clean});
    });
    return rows;
  }
  function closeLyrics(){
    if(!lyricPanel) return;
    lyricPanel.hidden=true;
    var disc=document.getElementById('disc');
    if(disc) disc.hidden=false;
  }
  function updateLyric(){
    if(!lyricPanel||lyricPanel.hidden) return;
    var audio=document.getElementById('audio'), time=Number(audio&&audio.currentTime||0), index=-1;
    lyricLines.forEach(function(line,i){ if(line.time>=0&&line.time<=time+.12) index=i; });
    if(index===activeLine) return; activeLine=index;
    lyricPanel.querySelectorAll('[data-lyric-line]').forEach(function(node,i){ node.classList.toggle('active',i===index); });
    var active=lyricPanel.querySelector('[data-lyric-line].active'), scroll=lyricPanel.querySelector('.lyrics-scroll');
    if(active&&scroll) scroll.scrollTo({top:Math.max(0,active.offsetTop-scroll.clientHeight/2+active.clientHeight/2),behavior:'smooth'});
  }
  function makePanel(track){
    if(!lyricPanel){
      var style=document.createElement('style'); style.id='listeningLyricStyles'; style.textContent='.disc-zone>.disc[hidden]{display:none!important}#listeningLyrics{position:relative;box-sizing:border-box;width:100%;height:100%;min-height:238px;padding:18px 8px 10px;color:#fff;cursor:pointer;overflow:hidden}#listeningLyrics[hidden]{display:none!important}#listeningLyrics .lyrics-scroll{box-sizing:border-box;height:100%;padding:42% 4px;overflow:auto;scrollbar-width:none;text-align:center;overscroll-behavior:contain}#listeningLyrics .lyrics-scroll::-webkit-scrollbar{display:none}#listeningLyrics p{margin:0 0 22px;color:rgba(255,255,255,.48);font-size:15px;line-height:1.55;transition:color .22s,transform .22s}#listeningLyrics p.active{color:#fff;font-size:19px;font-weight:600;transform:scale(1.03)}#listeningLyrics .lyric-translation{display:none;margin-top:4px;color:rgba(255,255,255,.6);font-size:12px;font-weight:400;transform:none}#listeningLyrics.show-translation .lyric-translation{display:block}#listeningLyrics .lyric-translation-toggle{position:absolute;z-index:2;top:5px;right:8px;width:28px;height:28px;padding:0;border:1px solid rgba(255,255,255,.42);border-radius:50%;background:rgba(0,0,0,.15);color:#fff;font:600 13px var(--font-b,system-ui);cursor:pointer}#listeningLyrics .lyric-translation-toggle.active{border-color:#fff;background:rgba(255,255,255,.18)}'; document.head.appendChild(style);
      lyricPanel=document.createElement('section'); lyricPanel.id='listeningLyrics'; lyricPanel.hidden=true;
      var zone=document.querySelector('.disc-zone'); if(!zone) return; zone.appendChild(lyricPanel); lyricPanel.onclick=closeLyrics;
    }
    lyricLines=parseLyrics(track&&track.lyrics); translationLines=parseLyrics(track&&track.translationLyrics); activeLine=-1; translationVisible=false;
    lyricPanel.classList.remove('show-translation');
    lyricPanel.innerHTML='<button class="lyric-translation-toggle" type="button" aria-label="显示中文释义" aria-pressed="false">译</button><div class="lyrics-scroll">'+(lyricLines.length?lyricLines.map(function(line){ var translated=translationLines.find(function(row){ return row.time===line.time; }); return '<p data-lyric-line><span>'+escapeHtml(line.text)+'</span>'+(translated&&translated.text?'<small class="lyric-translation">'+escapeHtml(translated.text)+'</small>':'')+'</p>'; }).join(''):'<p class="active">这首歌暂时没有歌词</p>')+'</div>';
    var toggle=lyricPanel.querySelector('.lyric-translation-toggle'); toggle.onclick=function(event){ event.stopPropagation(); translationVisible=!translationVisible; lyricPanel.classList.toggle('show-translation',translationVisible); toggle.classList.toggle('active',translationVisible); toggle.setAttribute('aria-pressed',translationVisible?'true':'false'); };
    var disc=document.getElementById('disc'); if(disc) disc.hidden=true;
    lyricPanel.hidden=false; updateLyric();
  }
  async function openLyrics(){
    try {
      var personalTrack=typeof window.getListeningLyricTrack==='function'?window.getListeningLyricTrack():null;
      if(personalTrack){ if(!personalTrack.translationLyrics&&personalTrack.songId){ try { var refreshed=await api('/api/listening/tracks/'+encodeURIComponent(personalTrack.songId)+'/refresh',{method:'POST'}); personalTrack=Object.assign({},personalTrack,refreshed.track||{}); } catch(ignore) {} } makePanel(personalTrack); return; }
      var params=new URLSearchParams(location.search), roomId=params.get('room');
      if(!roomId){ var rooms=await api('/api/listening/rooms'); roomId=(rooms.rooms||[]).find(function(room){return room.status!=='ended';})?.id||(rooms.rooms||[])[0]?.id; }
      if(!roomId) return; var result=await api('/api/listening/rooms/'+encodeURIComponent(roomId)), roomTrack=result.room&&result.room.currentTrack; if(roomTrack&&!roomTrack.translationLyrics&&roomTrack.songId){ try { var refreshedRoom=await api('/api/listening/tracks/'+encodeURIComponent(roomTrack.songId)+'/refresh',{method:'POST'}); roomTrack=Object.assign({},roomTrack,refreshedRoom.track||{}); } catch(ignore) {} } makePanel(roomTrack);
    } catch(error) { console.warn('Unable to open lyrics',error); }
  }
  function setup(){
    var disc=document.getElementById('disc'), audio=document.getElementById('audio');
    if(!disc||!audio) return; window.openListeningLyrics=openLyrics; disc.onclick=openLyrics; disc.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();openLyrics();},true); audio.addEventListener('timeupdate',updateLyric); audio.addEventListener('iris-trackchange',function(){ if(lyricPanel&&!lyricPanel.hidden) openLyrics(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup); else setup();
})();

/* Together rooms always reopen as rooms, and show their shared listening time.
   This is deliberately separate from the personal-player layout. */
(function(){
  if(!/\/listening\.html$/i.test(location.pathname)) return;
  var KEY='iris-memory-2024', params=new URLSearchParams(location.search), roomId=params.get('room');
  function api(path){ return fetch(path,{headers:{'x-api-key':KEY}}).then(function(response){ return response.json().then(function(data){ if(!response.ok) throw new Error(data.error||'请求失败'); return data; }); }); }
  function activeRoom(){ return api('/api/listening/rooms').then(function(data){ return (data.rooms||[]).find(function(room){ return room.status==='active'; })||null; }); }
  if(!roomId) return;
  function durationNode(){
    var node=document.getElementById('togetherDuration');
    if(node) return node;
    var members=document.getElementById('members');
    if(!members) return null;
    node=document.createElement('p'); node.id='togetherDuration'; node.className='together-duration';
    node.style.cssText='position:relative;z-index:10;margin:6px 0 0;text-align:center;color:rgba(255,255,255,.96);font-size:13px;line-height:1.35;letter-spacing:.02em;';
    members.insertAdjacentElement('afterend',node); return node;
  }
  function format(seconds){ seconds=Math.max(0,Math.floor(Number(seconds)||0)); return '和 TA 一起听了 '+Math.floor(seconds/3600)+' 小时 '+Math.floor(seconds%3600/60)+' 分钟'; }
  function update(){
    api('/api/listening/rooms/'+encodeURIComponent(roomId)).then(function(data){
      var room=data&&data.room; if(!room||room.status==='ended') return;
      var node=durationNode(); if(node) node.textContent=format(room.playedSeconds);
    }).catch(function(){});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',update); else update();
  setInterval(update,5000);
  document.addEventListener('click',function(event){
    if(!event.target.closest) return;
    if(event.target.closest('#disc')&&typeof window.openListeningLyrics==='function') { event.preventDefault(); event.stopImmediatePropagation(); window.openListeningLyrics(); return; }
    if(event.target.closest('#listenEndButton')){
      event.preventDefault(); event.stopImmediatePropagation();
      if(!confirm('结束这次一起听吗？')) return;
      fetch('/api/listening/rooms/'+encodeURIComponent(roomId)+'/complete',{method:'POST',headers:{'x-api-key':KEY,'Content-Type':'application/json'},body:'{}'})
        .then(function(response){ return response.json().then(function(data){ if(!response.ok) throw new Error(data.error||'结束失败'); return data; }); })
        .then(function(){ location.replace('listening.html'); })
        .catch(function(error){ alert(error.message); });
    }
  },true);
})();

/* Keep the shared top bar usable on independently loaded pages as well. */
(function(){
  function paint(){
    var avatar=document.getElementById('topBarAvatar'),title=document.getElementById('topBarTitle');
    if(!avatar&&!title) return;
    var image='',name='Iris',text='Iris 的小窝';
    try { image=localStorage.getItem('iris_avatar_img1')||''; name=localStorage.getItem('iris_avatar_name1')||name; text=localStorage.getItem('iris_topbar_title')||text; } catch(e) {}
    if(title) title.textContent=text;
    if(avatar&&!avatar.firstChild) avatar.innerHTML=image?'<img src="'+String(image).replace(/"/g,'%22')+'" alt="">':'<span class="top-bar-avatar-initial">'+name.charAt(0).toUpperCase()+'</span>';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',paint); else paint();
})();

// The joint listening profile treats its background as a local, personal
// decoration. A tap on the clear hero area selects a replacement image.
(function(){
  if(!/\/listening-profile\.html$/i.test(location.pathname)) return;
  function bind(){ var hero=document.getElementById('hero'), file=document.getElementById('heroFile'); if(hero&&file) hero.onclick=function(event){ if(event.target===hero) file.click(); }; }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();

/* ---- Chat in-app reminders ----
   Shared by every PWA page. The chat workspace owns the preference UI; this
   only shows a banner while the web app remains open on another page. */
(function(){
  var KEY = 'iris-memory-2024', workerReady = null;
  function api(path, options) {
    options = options || {};
    return fetch(path, Object.assign({}, options, { headers:Object.assign({'x-api-key':KEY,'Content-Type':'application/json'}, options.headers || {}) }))
      .then(function(response){ return response.json().catch(function(){ return {}; }).then(function(data){ if(!response.ok) throw new Error(data.error || '请求失败'); return data; }); });
  }
  function register() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('此浏览器不支持 PWA 通知'));
    if (!workerReady) workerReady = navigator.serviceWorker.register('/sw.js').then(function(){ return navigator.serviceWorker.ready; });
    return workerReady;
  }
  function ensureBanner(){
    var root = document.getElementById('irisReplyBannerStack');
    if (root) return root;
    var style = document.createElement('style'); style.id = 'irisReplyBannerStyle';
    style.textContent = '#irisReplyBannerStack{position:fixed;z-index:9999;top:max(12px,env(safe-area-inset-top));left:12px;right:12px;pointer-events:none}.iris-reply-banner{position:absolute;inset:0;display:grid;grid-template-columns:46px minmax(0,1fr) 25px;align-items:center;column-gap:11px;min-height:76px;box-sizing:border-box;padding:13px 14px;border:1px solid color-mix(in srgb,var(--accent,#886b62) 28%,#fff);border-radius:22px;background:color-mix(in srgb,var(--bg-card,#fff) 94%,#fff);box-shadow:0 12px 30px rgba(40,30,27,.2);color:var(--text,#342b28);transform:translateY(-128%);opacity:0;transition:transform .28s ease,opacity .28s ease;font:13px/1.4 system-ui,sans-serif;cursor:pointer;pointer-events:auto}.iris-reply-banner.show{transform:none;opacity:1}.iris-reply-banner.receding{transform:translateY(8px) scale(.98);opacity:0}.iris-reply-banner .iris-reply-avatar{position:relative;width:46px;height:46px;overflow:hidden;border-radius:50%;background:var(--accent-pale,#eee4df);display:grid;place-items:center;color:var(--accent,#886b62);font-weight:700;font-size:17px}.iris-reply-banner .iris-reply-avatar img{position:absolute;z-index:1;inset:0;display:block;width:100%;height:100%;object-fit:cover}.iris-reply-banner .iris-reply-copy{min-width:0}.iris-reply-banner strong{display:block;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.iris-reply-banner span{display:-webkit-box;overflow:hidden;color:var(--text-light,#7c716d);text-overflow:ellipsis;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-height:1.45;max-height:2.9em}.iris-reply-banner button{align-self:start;margin:0;border:0;background:transparent;color:inherit;font-size:21px;line-height:1;cursor:pointer}';
    document.head.appendChild(style); root = document.createElement('div');
    root.id = 'irisReplyBannerStack';
    document.body.appendChild(root); return root;
  }
  function showBanner(payload) {
    if (/\/chat\.html$/i.test(location.pathname)) return;
    var stack = ensureBanner(), url = payload.url || '/chat.html', root = document.createElement('div');
    stack.querySelectorAll('.iris-reply-banner.show').forEach(function(old){ old.classList.remove('show'); old.classList.add('receding'); setTimeout(function(){ old.remove(); }, 300); });
    root.className = 'iris-reply-banner'; root.setAttribute('role','button'); root.tabIndex = 0; root.setAttribute('aria-live','polite');
    root.innerHTML = '<div class="iris-reply-avatar"><img alt="" hidden><b></b></div><div class="iris-reply-copy"><strong></strong><span></span></div><button type="button" aria-label="关闭">×</button>';
    var title = payload.title || 'TA', avatar = root.querySelector('.iris-reply-avatar'), image = avatar.querySelector('img'), fallback = avatar.querySelector('b');
    image.hidden = !payload.avatar; image.src = payload.avatar || ''; fallback.textContent = String(title).trim().slice(0, 1) || 'T';
    root.querySelector('strong').textContent = title; root.querySelector('span').textContent = payload.body || '给你发来了一条消息';
    var dismiss = function(){ root.classList.remove('show'); root.classList.add('receding'); setTimeout(function(){ root.remove(); }, 300); };
    root.querySelector('button').onclick = function(event){ event.stopPropagation(); dismiss(); };
    root.onclick = function(){ location.href = url; };
    stack.appendChild(root); requestAnimationFrame(function(){ root.classList.add('show'); });
    setTimeout(dismiss, 7000);
  }
  var inboxTimer = null, inboxStarted = false;
  var INBOX_CURSOR_KEY = 'iris-chat-notification-cursor-v1';
  function inboxCursor(){ try { return localStorage.getItem(INBOX_CURSOR_KEY) || ''; } catch (error) { return ''; } }
  function saveInboxCursor(value){ try { if (value) localStorage.setItem(INBOX_CURSOR_KEY, value); } catch (error) {} }
  function messageCursor(message){
    var id = String(message && message.id || '').trim();
    var createdAt = String(message && message.createdAt || '').trim();
    return id && createdAt ? createdAt + '::' + id : '';
  }
  // Chat has already rendered this message, so it must never be replayed as a
  // reminder when the reader goes to another PWA page.
  function markMessageSeen(message){ saveInboxCursor(messageCursor(message)); }
  function inChatRoom(){ return /\/chat\.html$/i.test(location.pathname); }
  function inboxSchedule(delay){ clearTimeout(inboxTimer); inboxTimer = setTimeout(inboxPoll, delay); }
  function inboxPayloadGroups(messages, mode) {
    if (mode === 'each') return messages.map(function(message){ return [message]; });
    var grouped = new Map();
    messages.forEach(function(message){ var key = String(message.replyGroupId || message.id); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(message); });
    return Array.from(grouped.values());
  }
  function inboxShow(messages, settings) {
    inboxPayloadGroups(messages, settings.mode).forEach(function(group, index){
      var first = group[0], body = group.map(function(message){ return message.body || ''; }).filter(Boolean).join('\n');
      setTimeout(function(){ showBanner({ title:first.title || 'TA', avatar:first.avatar || '', body:body || '给你发来了一条消息', url:first.url || '/chat.html' }); }, settings.mode === 'each' ? index * Math.max(1, Number(settings.bubbleIntervalSeconds) || 2) * 1000 : 0);
    });
  }
  async function inboxPoll(){
    try {
      if (document.visibilityState !== 'visible') return;
      var cursor = inboxCursor();
      // Keep the cursor moving while the conversation is open.  This is a
      // read acknowledgement only: chat itself never creates an in-app banner.
      if (inChatRoom()) {
        var seenResult = await api('/api/chat/notifications/inbox' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
        if (seenResult && seenResult.cursor) saveInboxCursor(seenResult.cursor);
        return;
      }
      var settingsResult = await api('/api/chat/notifications');
      var settings = settingsResult.settings || {};
      if (!settings.enabled) return;
      var result = await api('/api/chat/notifications/inbox' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
      // The first page visit establishes a baseline. It must not turn old
      // conversation history into a pile of notifications.
      if (!cursor) saveInboxCursor(result.cursor);
      else if (Array.isArray(result.messages) && result.messages.length) {
        inboxShow(result.messages, settings);
        saveInboxCursor(result.cursor);
      } else if (result.cursor) saveInboxCursor(result.cursor);
    } catch (error) {
      // A temporary network failure should be silent; the next poll retries.
    } finally { inboxSchedule(3000); }
  }
  function startInboxWatch(){
    if (inboxStarted) return; inboxStarted = true;
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') inboxSchedule(0); });
    inboxSchedule(700);
  }
  window.IrisPwaNotifications = { showBanner:showBanner, markMessageSeen:markMessageSeen };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ register().catch(function(){}); startInboxWatch(); }); else { register().catch(function(){}); startInboxWatch(); }
})();

/* Keep all together-listening placeholders as the same line SVG, never a
   platform-dependent emoji glyph. Static pages may be cached independently,
   so this shared guard also handles an old fallback inserted at runtime. */
(function(){
  if (!/\/listening(?:-profile)?\.html$/i.test(location.pathname)) return;
  var markup = '<svg viewBox="0 0 24 24" class="listening-note-svg" aria-hidden="true"><path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>';
  function replaceNotes(root){
    if (!root || !root.ownerDocument && root !== document) return;
    var walker = document.createTreeWalker(root === document ? document.body : root, NodeFilter.SHOW_TEXT);
    var nodes = [], node;
    while ((node = walker.nextNode())) if (node.nodeValue.trim() === '🎵') nodes.push(node);
    nodes.forEach(function(text){ var wrap = document.createElement('span'); wrap.innerHTML = markup; text.parentNode.replaceChild(wrap.firstChild, text); });
  }
  function install(){
    var style = document.createElement('style');
    style.textContent = '.listening-note-svg{width:1em;height:1em;vertical-align:-.12em;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}#discEmpty .listening-note-svg{width:44px;height:44px}.member button .listening-note-svg{width:25px;height:25px}.profile-avatar .listening-note-svg{width:34px;height:34px}';
    document.head.appendChild(style); replaceNotes(document);
    new MutationObserver(function(records){ records.forEach(function(record){ record.addedNodes.forEach(function(node){ if (node.nodeType === 3 && node.nodeValue.trim() === '🎵') replaceNotes(node.parentNode); else if (node.nodeType === 1) replaceNotes(node); }); }); }).observe(document.body, { childList:true, subtree:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
