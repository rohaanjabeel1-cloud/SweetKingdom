(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const candyTypes = [
  {id:0,emoji:'🍓',name:'Berry',color:'#ff6f91'},
  {id:1,emoji:'🍋',name:'Lemon',color:'#ffcf55'},
  {id:2,emoji:'🍇',name:'Grape',color:'#b98bff'},
  {id:3,emoji:'🍏',name:'Apple',color:'#72db9d'},
  {id:4,emoji:'🫐',name:'Blueberry',color:'#75c8ff'},
  {id:5,emoji:'🍊',name:'Orange',color:'#ffad62'}
];
const levelNames=['Sugar Meadow','Lollipop Lane','Gummy Grove','Marshmallow Bay','Jellybean Jungle','Caramel Castle','Cotton Candy Cove','Chocolate Peaks','Rainbow Palace','Royal Candyland'];
const defaultSave={coins:250,level:1,unlocked:1,stars:{},dailyDate:'',dailyStreak:0,sound:true,music:false,boosters:{hammer:2,shuffle:1,extra:1}};
let save;
try { save={...defaultSave,...JSON.parse(localStorage.getItem('sweetKingdomSave')||'{}')}; save.boosters={...defaultSave.boosters,...(save.boosters||{})}; save.stars=save.stars||{}; } catch { save={...defaultSave,boosters:{...defaultSave.boosters},stars:{}}; }
let state={level:1,board:[],selected:null,moves:25,score:0,goals:{},goalTotals:{},busy:false,booster:null,swaps:0,ended:false,levelTarget:2500,sessionCoins:0};
let toastTimer, hintTimer, audioCtx;
const boardEl=$('#board');
function persist(){localStorage.setItem('sweetKingdomSave',JSON.stringify(save));updateCoins();}
function updateCoins(){$('#coins').textContent=save.coins.toLocaleString();}
function showScreen(id){$$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));$$('.nav-item').forEach(n=>n.classList.toggle('selected',n.dataset.nav===id));if(id==='mapScreen')renderMap();}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300);}
function sound(type='match'){
 if(!save.sound)return;
 try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const now=audioCtx.currentTime;const notes=type==='swap'?[420]:type==='match'?[620,790,950]:type==='win'?[523,659,784,1046]:[280,220];notes.forEach((f,i)=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(f,now+i*.065);g.gain.setValueAtTime(.0001,now+i*.065);g.gain.exponentialRampToValueAtTime(.07,now+i*.065+.012);g.gain.exponentialRampToValueAtTime(.0001,now+i*.065+.13);o.connect(g);g.connect(audioCtx.destination);o.start(now+i*.065);o.stop(now+i*.065+.15);});}catch{}
}
function levelTarget(level=state.level){return 2200+Math.min(level-1,99)*170;}
function levelMoves(level=state.level){return Math.max(18,25-Math.floor((level-1)/8));}
function randomCandy(){return Math.floor(Math.random()*candyTypes.length);}
function makeBoard(){
 const b=Array.from({length:64},()=>null);
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  let v,tries=0;do{v=randomCandy();tries++;}while(tries<30&&((c>=2&&b[r*8+c-1]?.type===v&&b[r*8+c-2]?.type===v)||(r>=2&&b[(r-1)*8+c]?.type===v&&b[(r-2)*8+c]?.type===v)));
  b[r*8+c]={type:v,special:null};
 }
 return b;
}
function startLevel(level=save.level){
 state.level=level;state.board=makeBoard();state.selected=null;state.moves=levelMoves(level);state.score=0;state.busy=false;state.booster=null;state.swaps=0;state.ended=false;state.sessionCoins=0;state.levelTarget=levelTarget(level);
 const count=Math.min(5,3+Math.floor((level-1)/5));state.goals={};state.goalTotals={};
 let types=[0,1,2,3,4,5].sort(()=>Math.random()-.5).slice(0,Math.min(3+Math.floor((level-1)/12),5));
 types.forEach(t=>{state.goals[t]=count+Math.floor(level/8);state.goalTotals[t]=state.goals[t];});
 $('#levelName').textContent=levelNames[Math.floor((level-1)/10)%levelNames.length];
 $('#levelNumber').textContent=String(level).padStart(2,'0');$('#moves').textContent=state.moves;
 $('#hint').textContent='Swap two neighbouring candies to match 3 or more!';
 updateGoalUI();updateScoreUI();updateBoosters();renderBoard();showScreen('gameScreen');startHintLoop();
}
function renderBoard(){
 boardEl.innerHTML='';
 state.board.forEach((cell,i)=>{
  const el=document.createElement('button');el.type='button';el.className='cell';el.dataset.i=i;el.setAttribute('aria-label',cell?candyTypes[cell.type].name+' candy':'empty');
  if(state.selected===i)el.classList.add('selected');if(cell?.special)el.classList.add('special');
  if(cell){const span=document.createElement('span');span.className='candy';span.textContent=cell.special==='rainbow'?'🌈':cell.special==='row'?'⚡':cell.special==='bomb'?'💥':candyTypes[cell.type].emoji;el.appendChild(span);}
  el.addEventListener('click',()=>onCell(i));boardEl.appendChild(el);
 });
}
function updateGoalUI(){
 const el=$('#goals');el.innerHTML='';
 Object.keys(state.goals).forEach(k=>{const g=document.createElement('span');g.className='goal';g.innerHTML=`${candyTypes[k].emoji}<b>${state.goals[k]}</b>`;el.appendChild(g);});
}
function updateScoreUI(){
 $('#score').textContent=state.score.toLocaleString();$('#targetScore').textContent=`${Math.min(state.score,state.levelTarget).toLocaleString()} / ${state.levelTarget.toLocaleString()}`;
 $('#scoreBar').style.width=Math.min(100,state.score/state.levelTarget*100)+'%';$('#moves').textContent=state.moves;
}
function updateBoosters(){
 $('#hammerCount').textContent=save.boosters.hammer+' left';$('#shuffleCount').textContent=save.boosters.shuffle+' left';$('#extraCount').textContent=save.boosters.extra+' left';
 $$('.booster').forEach(b=>{b.disabled=state.busy||state.ended; b.classList.toggle('active',state.booster===b.dataset.booster);});
}
function onCell(i){
 if(state.busy||state.ended)return;
 if(state.booster){useBoosterOn(i);return;}
 if(state.selected===null){state.selected=i;renderBoard();return;}
 if(state.selected===i){state.selected=null;renderBoard();return;}
 const a=state.selected,b=i,ar=Math.floor(a/8),ac=a%8,br=Math.floor(b/8),bc=b%8;
 if(Math.abs(ar-br)+Math.abs(ac-bc)!==1){state.selected=i;renderBoard();return;}
 swapCells(a,b,true);
}
function swapCells(a,b,spend){
 if(state.busy)return;
 [state.board[a],state.board[b]]=[state.board[b],state.board[a]];
 const hits=findMatches();
 if(!hits.size&&!state.board[a]?.special&&!state.board[b]?.special){
  state.selected=null;renderBoard();sound('bad');toast('No match there! Try another swap.');return;
 }
 if(spend){state.moves--;state.swaps++;sound('swap');}
 state.selected=null;state.busy=true;updateBoosters();renderBoard();
 setTimeout(()=>resolveMove(new Set([...hits,a,b])),130);
}
function findMatches(){
 const out=new Set();
 for(let r=0;r<8;r++){let start=0;while(start<8){let t=state.board[r*8+start]?.type,end=start+1;while(t!==undefined&&end<8&&state.board[r*8+end]?.type===t)end++;if(t!==undefined&&end-start>=3)for(let c=start;c<end;c++)out.add(r*8+c);start=end;}}
 for(let c=0;c<8;c++){let start=0;while(start<8){let t=state.board[start*8+c]?.type,end=start+1;while(t!==undefined&&end<8&&state.board[end*8+c]?.type===t)end++;if(t!==undefined&&end-start>=3)for(let r=start;r<end;r++)out.add(r*8+c);start=end;}}
 return out;
}
function expandSpecials(hits){
 const expanded=new Set(hits),queue=[...hits];
 while(queue.length){const i=queue.pop(),cell=state.board[i];if(!cell?.special)continue;
  let extra=[];if(cell.special==='row')for(let c=0;c<8;c++)extra.push(Math.floor(i/8)*8+c);
  else if(cell.special==='bomb'){for(let r=Math.max(0,Math.floor(i/8)-1);r<=Math.min(7,Math.floor(i/8)+1);r++)for(let c=Math.max(0,i%8-1);c<=Math.min(7,i%8+1);c++)extra.push(r*8+c);}
  else if(cell.special==='rainbow'){const type=cell.type;state.board.forEach((x,j)=>{if(x?.type===type)extra.push(j);});}
  extra.forEach(j=>{if(!expanded.has(j)){expanded.add(j);queue.push(j);}});
 }
 return expanded;
}
function resolveMove(hits,depth=0){
 if(depth>12){state.busy=false;finishMove();return;}
 let real=findMatches();hits=new Set([...hits,...real]);
 const valid=[...hits].filter(i=>state.board[i]);
 if(!valid.length){state.busy=false;finishMove();return;}
 hits=expandSpecials(new Set(valid));
 const cells=[...hits].filter(i=>state.board[i]);
 // A four/five match can create a special candy where the swap ended.
 let specialSpot=null,specialKind=null;
 for(let i of cells){let row=Math.floor(i/8),col=i%8;let rowLen=1,colLen=1;
  for(let c=col-1;c>=0&&state.board[row*8+c]?.type===state.board[i].type;c--)rowLen++;
  for(let c=col+1;c<8&&state.board[row*8+c]?.type===state.board[i].type;c++)rowLen++;
  for(let r=row-1;r>=0&&state.board[r*8+col]?.type===state.board[i].type;r--)colLen++;
  for(let r=row+1;r<8&&state.board[r*8+col]?.type===state.board[i].type;r++)colLen++;
  if(rowLen>=5||colLen>=5){specialSpot=i;specialKind='rainbow';break;}
  if(rowLen>=4||colLen>=4){specialSpot=i;specialKind='row';}
 }
 const specialCell=specialSpot!==null?state.board[specialSpot]:null;
 if(specialSpot!==null)state.board[specialSpot]={...specialCell,special:specialKind};
 let gain=0;
 cells.forEach(i=>{
  if(i===specialSpot)return;const cell=state.board[i];if(!cell)return;
  if(state.goals[cell.type]>0)state.goals[cell.type]=Math.max(0,state.goals[cell.type]-1);
  gain+=100;
 });
 if(cells.length>=4)gain+=cells.length*25;
 state.score+=gain;updateGoalUI();updateScoreUI();sound('match');
 cells.forEach(i=>{const el=boardEl.children[i];if(el)el.classList.add('pop');});
 setTimeout(()=>{
  cells.forEach(i=>{if(i!==specialSpot)state.board[i]=null;});
  for(let c=0;c<8;c++){let write=7;for(let r=7;r>=0;r--){let i=r*8+c;if(state.board[i]){let target=write*8+c;if(target!==i){state.board[target]=state.board[i];state.board[i]=null;}write--;}}for(let r=write;r>=0;r--)state.board[r*8+c]={type:randomCandy(),special:null};}
  renderBoard();
  setTimeout(()=>{const next=findMatches();if(next.size)resolveMove(next,depth+1);else{state.busy=false;finishMove();}},110);
 },220);
}
function finishMove(){
 updateBoosters();
 if(Object.values(state.goals).every(v=>v<=0)&&state.score>=state.levelTarget){winLevel();return;}
 if(state.moves<=0){loseLevel();return;}
 if(!hasPossibleMove()){shuffleBoard(false);toast('A fresh board! Keep going ✨');}
 updateScoreUI();
}
function hasPossibleMove(){
 for(let i=0;i<64;i++){let r=Math.floor(i/8),c=i%8;for(let j of [c<7?i+1:-1,r<7?i+8:-1])if(j>=0){[state.board[i],state.board[j]]=[state.board[j],state.board[i]];let yes=findMatches().size>0;[state.board[i],state.board[j]]=[state.board[j],state.board[i]];if(yes)return true;}}
 return false;
}
function shuffleBoard(useBooster=true){
 if(useBooster){if(save.boosters.shuffle<=0){toast('No shuffles left!');return;}save.boosters.shuffle--;persist();}
 for(let n=0;n<80;n++){state.board=state.board.map(()=>({type:randomCandy(),special:null}));if(!findMatches().size&&hasPossibleMove())break;}
 state.selected=null;state.busy=false;renderBoard();updateBoosters();sound('swap');
}
function useBoosterOn(i){
 const b=state.booster;state.booster=null;
 if(b==='hammer'){
  if(save.boosters.hammer<=0){toast('No hammers left!');updateBoosters();return;}
  save.boosters.hammer--;const cell=state.board[i];if(cell&&state.goals[cell.type]>0)state.goals[cell.type]--;state.board[i]=null;state.score+=150;state.moves=Math.max(0,state.moves-0);
  for(let c=i%8;c<8;c++){const above=Math.floor(i/8)*8+c; if(above!==i&&state.board[above]){state.board[i]=state.board[above];state.board[above]=null;break;}}
  for(let c=0;c<8;c++){for(let r=7;r>=0;r--)if(!state.board[r*8+c]){for(let rr=r-1;rr>=0;rr--)if(state.board[rr*8+c]){state.board[r*8+c]=state.board[rr*8+c];state.board[rr*8+c]=null;break;}if(!state.board[r*8+c])state.board[r*8+c]={type:randomCandy(),special:null};}}
  persist();updateGoalUI();updateScoreUI();renderBoard();sound('match');toast('Smash! Sweet work!');finishMove();
 }
 updateBoosters();
}
function winLevel(){
 if(state.ended)return;state.ended=true;state.busy=true;sound('win');
 const stars=state.score>=state.levelTarget*1.8?3:state.score>=state.levelTarget*1.35?2:1;
 save.stars[state.level]=Math.max(save.stars[state.level]||0,stars);save.coins+=50+stars*10;save.unlocked=Math.max(save.unlocked,state.level+1);save.level=Math.max(save.level,state.level+1);persist();
 $('#resultEmoji').textContent='🎉';$('#resultEyebrow').textContent='SWEET SUCCESS';$('#resultTitle').textContent='Level Complete!';$('#resultText').textContent='You made the kingdom a little sweeter. Ready for another adventure?';$('#resultStars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);$('#resultCoins').textContent='+'+(50+stars*10);$('#resultScore').textContent=state.score.toLocaleString();$('#resultPrimary').textContent='NEXT LEVEL  ➜';$('#resultSecondary').textContent='Back to Kingdom';$('#resultPrimary').onclick=()=>startLevel(state.level+1);$('#resultSecondary').onclick=()=>showScreen('homeScreen');showScreen('resultScreen');
}
function loseLevel(){
 if(state.ended)return;state.ended=true;state.busy=true;sound('bad');
 $('#resultEmoji').textContent='🥺';$('#resultEyebrow').textContent='SO CLOSE!';$('#resultTitle').textContent='One more try?';$('#resultText').textContent='The candies are cheering for you. Try a new strategy and make a sweeter score!';$('#resultStars').textContent='☆☆☆';$('#resultCoins').textContent='+0';$('#resultScore').textContent=state.score.toLocaleString();$('#resultPrimary').textContent='TRY AGAIN  ↻';$('#resultSecondary').textContent='Back to Kingdom';$('#resultPrimary').onclick=()=>startLevel(state.level);$('#resultSecondary').onclick=()=>showScreen('homeScreen');showScreen('resultScreen');
}
function startHintLoop(){clearInterval(hintTimer);hintTimer=setInterval(()=>{if(!state.busy&&!state.ended&&state.selected===null&&$('#gameScreen').classList.contains('active')){const moves=[];for(let i=0;i<64;i++){for(let j of [i%8<7?i+1:-1,Math.floor(i/8)<7?i+8:-1])if(j>=0){[state.board[i],state.board[j]]=[state.board[j],state.board[i]];if(findMatches().size)moves.push([i,j]);[state.board[i],state.board[j]]=[state.board[j],state.board[i]];}}if(moves.length){const m=moves[Math.floor(Math.random()*moves.length)];[m[0],m[1]].forEach(i=>boardEl.children[i]?.classList.add('hint-cell'));setTimeout(()=>$$('.hint-cell').forEach(e=>e.classList.remove('hint-cell')),1800);}}},8000);}
function renderMap(){
 $('#mapProgressText').textContent=`Level ${Math.min(save.unlocked,100)} of 100`;$('#mapProgressBar').style.width=Math.min(100,(save.unlocked-1)/99*100)+'%';const path=$('#mapPath');path.innerHTML='';
 for(let n=1;n<=100;n++){const b=document.createElement('button');b.className='map-node '+(n<save.unlocked?'done':n===save.unlocked?'current':'');b.innerHTML=`<span class="node-icon">${n<save.unlocked?'⭐':n===save.unlocked?'🏰':n%10===0?'👑':'🔒'}</span><small>${n===save.unlocked?'PLAY':`LEVEL ${n}`}</small>`;b.disabled=n>save.unlocked;b.addEventListener('click',()=>startLevel(n));path.appendChild(b);}
}
function openModal({emoji='✨',title='A little magic',text='',action='Lovely!',onAction=null,extra=''}){
 $('#modalEmoji').textContent=emoji;$('#modalTitle').textContent=title;$('#modalText').textContent=text;$('#modalExtra').innerHTML=extra;$('#modalAction').textContent=action;$('#modalAction').onclick=()=>{closeModal();if(onAction)onAction();};$('#modalBackdrop').classList.add('open');
}
function closeModal(){$('#modalBackdrop').classList.remove('open');}
function claimDaily(){
 const today=new Date().toLocaleDateString('en-CA');if(save.dailyDate===today){openModal({emoji:'🍬',title:'Already collected!',text:'Your daily treat is safe in your treasure chest. Come back tomorrow for another!',action:'Sweet!'});return;}
 const yesterday=new Date(Date.now()-86400000).toLocaleDateString('en-CA');save.dailyStreak=save.dailyDate===yesterday?(save.dailyStreak||0)+1:1;const reward=100+Math.min(save.dailyStreak-1,6)*25;save.dailyDate=today;save.coins+=reward;save.boosters.hammer++;persist();$('#dailyStatus').textContent='Collected today ✓';openModal({emoji:'🎁',title:'Daily Treat!',text:`A little sweetness just for you!\n\n🪙 ${reward} coins + 🔨 1 hammer\n🔥 Day ${save.dailyStreak} streak`,action:'Thank you!',onAction:()=>{$('#dailyStatus').textContent='Come back tomorrow';}});sound('win');
}
function settings(){
 const extra=`<div class="setting-row"><span>Sound effects</span><button class="toggle ${save.sound?'on':''}" id="soundToggle">${save.sound?'ON':'OFF'}</button></div><div class="setting-row"><span>Reduce animations</span><button class="toggle" id="animToggle">OFF</button></div><div class="setting-row"><span>Reset game progress</span><button class="toggle" id="resetProgress" style="background:#ffe2e8;color:#b53663">RESET</button></div>`;
 openModal({emoji:'⚙️',title:'Game Settings',text:'Make your kingdom feel just right.',action:'Done',extra});
 $('#soundToggle').onclick=e=>{save.sound=!save.sound;e.currentTarget.textContent=save.sound?'ON':'OFF';e.currentTarget.classList.toggle('on',save.sound);persist();};
 $('#animToggle').onclick=e=>{document.body.classList.toggle('reduced-motion');e.currentTarget.classList.toggle('on');e.currentTarget.textContent=e.currentTarget.classList.contains('on')?'ON':'OFF';};
 $('#resetProgress').onclick=()=>openModal({emoji:'⚠️',title:'Start fresh?',text:'This resets your levels, coins and boosters. This cannot be undone.',action:'Reset progress',onAction:()=>{localStorage.removeItem('sweetKingdomSave');location.reload();}});
}
$('#playBtn').onclick=()=>startLevel(save.unlocked);$('#navPlay').onclick=()=>startLevel(save.unlocked);$('#levelsBtn').onclick=()=>showScreen('mapScreen');$('#dailyBtn').onclick=claimDaily;$('#navDaily').onclick=claimDaily;$('#settingsBtn').onclick=settings;
$('#gameBack').onclick=()=>{if(state.busy)return;showScreen('homeScreen');};
$('#restartBtn').onclick=()=>openModal({emoji:'🔄',title:'Restart level?',text:'Start this level again with a fresh board and all your moves.',action:'Restart',onAction:()=>startLevel(state.level)});
$$('[data-home]').forEach(b=>b.onclick=()=>showScreen('homeScreen'));
$$('[data-nav]').forEach(b=>b.addEventListener('click',()=>{const target=b.dataset.nav;if(target==='gameScreen')startLevel(save.unlocked);else showScreen(target);}));
$$('.booster').forEach(b=>b.addEventListener('click',()=>{
 if(state.busy||state.ended)return;const type=b.dataset.booster;
 if(type==='extra'){if(save.boosters.extra<=0){toast('No extra-move treats left!');return;}save.boosters.extra--;state.moves+=5;persist();updateScoreUI();updateBoosters();toast('✨ Five extra moves!');sound('win');return;}
 if(save.boosters[type]<=0){toast('You are out of this booster!');return;}
 if(type==='shuffle'){shuffleBoard(true);toast('Fresh candies, fresh chances!');return;}
 state.booster=type;updateBoosters();$('#hint').textContent='Tap a candy to smash it with your hammer!';toast('Choose a candy to smash.');
}));
$('#modalClose').onclick=closeModal;$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
updateCoins();$('#dailyStatus').textContent=save.dailyDate===new Date().toLocaleDateString('en-CA')?'Collected today ✓':'A little gift for you';
renderMap();
})();