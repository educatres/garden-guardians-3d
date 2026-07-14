import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const canvas = document.querySelector('#game');
const mobileView = innerWidth < 720;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd5f0);
scene.fog = new THREE.Fog(0x8fd5f0, mobileView ? 38 : 24, mobileView ? 85 : 55);

const camera = new THREE.PerspectiveCamera(mobileView ? 58 : 48, innerWidth / innerHeight, 0.1, 100);
camera.position.set(mobileView ? -12 : -7, mobileView ? 22 : 13, mobileView ? 32 : 18);
camera.lookAt(4, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, canvas);
controls.target.set(4, .8, 0);
controls.enableDamping = true;
controls.dampingFactor = .06;
controls.minDistance = 11;
controls.maxDistance = mobileView ? 58 : 34;
controls.minPolarAngle = .35;
controls.maxPolarAngle = Math.PI / 2.08;
controls.update();

scene.add(new THREE.HemisphereLight(0xe6f7ff, 0x54733e, 2.1));
const sunLight = new THREE.DirectionalLight(0xfff4c7, 2.8);
sunLight.position.set(-8, 18, 9); sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048); scene.add(sunLight);

const ROWS = 5, COLS = 9, CELL = 1.7;
const x0 = -1.5, z0 = -(ROWS - 1) * CELL / 2;
const gridGroup = new THREE.Group(); scene.add(gridGroup);
const plants = [], zombies = [], projectiles = [], suns = [];
let selectedPlant = 'shooter', sun = 150, score = 0, wave = 1, paused = true, gameOver = false, started = false;
let spawnTimer = 0, spawnedThisWave = 0, waveGap = 0;
const occupied = new Map();

const difficultyDefs = {
  easy:{label:'簡單',initialSun:250,hpMultiplier:.75,speedMultiplier:.82,attackDamage:18,enemyBonus:-1,spawnBase:2.45,minSpawn:.9,sunValue:30},
  medium:{label:'中間',initialSun:150,hpMultiplier:1,speedMultiplier:1,attackDamage:25,enemyBonus:0,spawnBase:2.1,minSpawn:.7,sunValue:25},
  hard:{label:'困難',initialSun:100,hpMultiplier:1.4,speedMultiplier:1.25,attackDamage:34,enemyBonus:2,spawnBase:1.75,minSpawn:.52,sunValue:20}
};
let difficulty = difficultyDefs.medium;

const plantDefs = {
  shooter:{cost:100, hp:100, cooldown:1.25, color:0x54b948, damage:20, slow:false},
  sunflower:{cost:50, hp:75, cooldown:7, color:0xf4c542},
  wall:{cost:75, hp:420, cooldown:0, color:0x9c6b3d},
  ice:{cost:125, hp:90, cooldown:1.7, color:0x67cce8, damage:15, slow:true}
};

function box(w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.8}));m.castShadow=m.receiveShadow=true;return m}
function sphere(r,color){const m=new THREE.Mesh(new THREE.SphereGeometry(r,20,16),new THREE.MeshStandardMaterial({color,roughness:.72}));m.castShadow=true;return m}
function cylinder(rt,rb,h,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,18),new THREE.MeshStandardMaterial({color,roughness:.8}));m.castShadow=true;return m}

const natureLoader = new GLTFLoader();
let zombieTemplate=null,zombieAnimations=[];

function normalizeModel(model,targetHeight){
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  const scale=targetHeight/size.y;model.scale.setScalar(scale);bounds.setFromObject(model);
  const center=bounds.getCenter(new THREE.Vector3());model.position.set(-center.x,-bounds.min.y,-center.z);return model
}

async function loadNatureModels(){
  const [tree,bush,rock,house,zombie] = await Promise.all([
    natureLoader.loadAsync('assets/models/tree_default.glb'),
    natureLoader.loadAsync('assets/models/plant_bushDetailed.glb'),
    natureLoader.loadAsync('assets/models/rock_largeA.glb'),
    natureLoader.loadAsync('assets/models/fantasy-house.glb'),
    natureLoader.loadAsync('assets/models/cute-zombie.glb')
  ]);
  const addCopies=(source,placements)=>placements.forEach(([x,z,scale,rotation=0])=>{
    const model=source.scene.clone(true);model.position.set(x,0,z);model.scale.setScalar(scale);model.rotation.y=rotation;
    model.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true}});scene.add(model)
  });
  addCopies(tree,[[-6.8,-6.1,1.35,.3],[-2.5,6.15,1.15,1.1],[4.8,-6.25,1.25,2.4],[11.2,6.15,1.4,.8],[20,-5.8,1.2,2]]);
  addCopies(bush,[[-4.6,-4.5,1.15,.5],[-4.2,4.5,.9,2.1],[8.2,-5.6,.9,1.6],[14,5.7,1.1,.4],[21,3.8,.85,2.8]]);
  addCopies(rock,[[-7.2,4.7,.75,.4],[7,-5.75,.55,1.8],[13.2,5.85,.7,2.4],[21,-3.7,.62,.9]]);
  const houseModel=normalizeModel(house.scene,5.2);houseModel.position.add(new THREE.Vector3(-5.4,0,0));houseModel.rotation.y=Math.PI/2;
  houseModel.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true}});scene.add(houseModel);
  zombieTemplate=normalizeModel(zombie.scene,2.25);zombieAnimations=zombie.animations
}

function buildWorld(){
  const ground=box(28,.35,15,0x6aa84f);ground.position.set(4,-.28,0);scene.add(ground);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const tile=box(CELL-.08,.06,CELL-.08,(r+c)%2?0x76bd55:0x82c960);
    tile.position.set(x0+c*CELL,0,z0+r*CELL); tile.userData={r,c,tile:true}; gridGroup.add(tile);
  }
  const path=box(5,.08,15,0xc6b483);path.position.set(17,-.04,0);scene.add(path);
  for(let r=0;r<ROWS;r++){const mower=box(.8,.35,.8,0xd54235);mower.position.set(-2.9,.22,z0+r*CELL);scene.add(mower)}
}

function makePlant(type,r,c){
  const g=new THREE.Group(); const def=plantDefs[type];
  const stem=cylinder(.11,.16,.8,0x398844);stem.position.y=.42;g.add(stem);
  if(type==='sunflower'){
    const center=sphere(.28,0x7b4b1f);center.position.y=1.15;g.add(center);
    for(let i=0;i<10;i++){const petal=sphere(.18,0xffd642);const a=i*Math.PI/5;petal.scale.set(1.4,.7,.45);petal.position.set(Math.cos(a)*.42,1.15+Math.sin(a)*.42,0);g.add(petal)}
  }else if(type==='wall'){
    g.clear(); const body=sphere(.62,0xa66b38);body.scale.y=1.2;body.position.y=.7;g.add(body); const eye1=sphere(.07,0x111111),eye2=eye1.clone();eye1.position.set(.28,.85,.48);eye2.position.set(-.05,.85,.57);g.add(eye1,eye2)
  }else{
    const head=sphere(.48,def.color);head.position.y=1.15;g.add(head);
    const muzzle=cylinder(.24,.32,.62,def.color);muzzle.rotation.z=Math.PI/2;muzzle.position.set(.55,1.18,0);g.add(muzzle);
    const eye=sphere(.075,0x111111);eye.position.set(.2,1.31,.42);g.add(eye)
  }
  g.position.set(x0+c*CELL,.05,z0+r*CELL);g.userData={type,r,c,hp:def.hp,maxHp:def.hp,timer:Math.random(),alive:true};scene.add(g);plants.push(g);occupied.set(`${r},${c}`,g);
}

function makeZombie(row){
  const g=new THREE.Group();
  if(zombieTemplate){
    const model=cloneSkeleton(zombieTemplate);model.rotation.y=-Math.PI/2;model.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true}});g.add(model);
    if(zombieAnimations.length){const mixer=new THREE.AnimationMixer(model),clip=zombieAnimations.find(a=>/walk|run/i.test(a.name))||zombieAnimations[0];mixer.clipAction(clip).play();g.userData.mixer=mixer}
  }else{
    const body=box(.65,1.25,.5,0x6a5c84);body.position.y=1.15;g.add(body);const head=sphere(.42,0x9ab48e);head.position.y=2.05;g.add(head)
  }
  g.position.set(18,0,z0+row*CELL);g.userData={...g.userData,row,hp:(100+wave*22)*difficulty.hpMultiplier,speed:(.43+wave*.035)*difficulty.speedMultiplier,attackTimer:0,slow:0};scene.add(g);zombies.push(g)
}

function shoot(p){
  const type=p.userData.type, def=plantDefs[type]; const pea=sphere(.14,type==='ice'?0x8fe9ff:0x68d35a);pea.position.copy(p.position).add(new THREE.Vector3(.7,1.15,0));pea.userData={row:p.userData.r,damage:def.damage,slow:def.slow,speed:5.2};scene.add(pea);projectiles.push(pea)
}
function createSun(p){const s=sphere(.22,0xffdf3a);s.position.copy(p.position).add(new THREE.Vector3(0,2,0));s.userData={life:8,value:difficulty.sunValue,baseY:s.position.y};scene.add(s);suns.push(s)}
function removeObj(arr,obj){const i=arr.indexOf(obj);if(i>=0)arr.splice(i,1);scene.remove(obj)}

function updatePlants(dt){
  for(const p of [...plants]){
    if(!p.userData.alive)continue; const d=plantDefs[p.userData.type]; p.userData.timer-=dt;
    if(p.userData.type==='sunflower'&&p.userData.timer<=0){createSun(p);p.userData.timer=d.cooldown}
    if((p.userData.type==='shooter'||p.userData.type==='ice')&&p.userData.timer<=0){
      const target=zombies.some(z=>z.userData.row===p.userData.r&&z.position.x>p.position.x);
      if(target){shoot(p);p.userData.timer=d.cooldown}
    }
  }
}
function updateProjectiles(dt){
  for(const b of [...projectiles]){b.position.x+=b.userData.speed*dt;b.rotation.y+=dt*8;
    const hit=zombies.find(z=>z.userData.row===b.userData.row&&Math.abs(z.position.x-b.position.x)<.5);
    if(hit){hit.userData.hp-=b.userData.damage;if(b.userData.slow)hit.userData.slow=2.5;removeObj(projectiles,b);if(hit.userData.hp<=0){score+=10;removeObj(zombies,hit);updateUI()}continue}
    if(b.position.x>21)removeObj(projectiles,b)
  }
}
function updateZombies(dt){
  for(const z of [...zombies]){
    z.userData.mixer?.update(dt);
    if(z.userData.slow>0)z.userData.slow-=dt;const speed=z.userData.speed*(z.userData.slow>0?.48:1);
    const target=plants.find(p=>p.userData.r===z.userData.row&&p.position.x<z.position.x&&z.position.x-p.position.x<1.05);
    if(target){z.userData.attackTimer-=dt;if(z.userData.attackTimer<=0){target.userData.hp-=difficulty.attackDamage;z.userData.attackTimer=.75;target.scale.y=.9;setTimeout(()=>target.scale.y=1,100);if(target.userData.hp<=0){occupied.delete(`${target.userData.r},${target.userData.c}`);target.userData.alive=false;removeObj(plants,target)}}}
    else z.position.x-=speed*dt;
    if(z.position.x<-3.15){finish(false);return}
  }
}
function updateSuns(dt){for(const s of [...suns]){s.userData.life-=dt;s.rotation.y+=dt*2;s.position.y=s.userData.baseY+Math.sin(performance.now()*.004)*.16;if(s.userData.life<=0)removeObj(suns,s)}}
function updateWaves(dt){
  if(spawnedThisWave<4+wave*2+difficulty.enemyBonus){spawnTimer-=dt;if(spawnTimer<=0){makeZombie(Math.floor(Math.random()*ROWS));spawnedThisWave++;spawnTimer=Math.max(difficulty.minSpawn,difficulty.spawnBase-wave*.18)}}
  else if(zombies.length===0){waveGap+=dt;if(waveGap>2.5){if(wave>=5){finish(true)}else{wave++;spawnedThisWave=0;spawnTimer=.8;waveGap=0;toast(`第 ${wave} 波來襲！`);updateUI()}}}
}

function finish(win){gameOver=true;paused=true;document.querySelector('#overlay').classList.remove('hidden');document.querySelector('#resultTitle').textContent=win?'🎉 庭院守住了！':'🧟 殭屍闖進房子了';document.querySelector('#resultText').textContent=`最終分數：${score}　抵達波次：${wave}`}
function toast(msg){const el=document.querySelector('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1400)}
function updateUI(){document.querySelector('#sunCount').textContent=sun;document.querySelector('#scoreCount').textContent=score;document.querySelector('#waveCount').textContent=`${wave} / 5`}

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pointerXY(e){pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1}
function handleCanvasTap(e){if(paused||gameOver)return;pointerXY(e);raycaster.setFromCamera(pointer,camera);
  const sunHit=raycaster.intersectObjects(suns,false)[0];if(sunHit){sun+=sunHit.object.userData.value;removeObj(suns,sunHit.object);updateUI();return}
  const hit=raycaster.intersectObjects(gridGroup.children,false)[0];if(!hit)return;const {r,c}=hit.object.userData,key=`${r},${c}`,def=plantDefs[selectedPlant];
  if(occupied.has(key)){toast('這格已經有植物了');return}if(sun<def.cost){toast('陽光不足');return}sun-=def.cost;makePlant(selectedPlant,r,c);updateUI()
}
let pressStart=null,dragged=false;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pressStart={x:e.clientX,y:e.clientY};dragged=false});
canvas.addEventListener('pointermove',e=>{if(pressStart&&Math.hypot(e.clientX-pressStart.x,e.clientY-pressStart.y)>6)dragged=true});
canvas.addEventListener('pointerup',e=>{if(pressStart&&!dragged)handleCanvasTap(e);pressStart=null});
canvas.addEventListener('pointercancel',()=>{pressStart=null});

document.querySelectorAll('.plant-card').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.plant-card').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedPlant=btn.dataset.plant}));
document.querySelector('#pauseBtn').addEventListener('click',()=>{if(!started)return;paused=!paused;document.querySelector('#pauseBtn').textContent=paused?'繼續':'暫停'});
document.querySelector('#restartBtn').addEventListener('click',()=>location.reload());
document.querySelectorAll('.difficulty-option').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.difficulty-option').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected')}));
document.querySelector('#startGameBtn').addEventListener('click',()=>{
  const key=document.querySelector('.difficulty-option.selected').dataset.difficulty;difficulty=difficultyDefs[key];sun=difficulty.initialSun;started=true;paused=false;
  document.querySelector('#difficultyLabel').textContent=`${difficulty.label}模式`;document.querySelector('#setupOverlay').classList.add('hidden');updateUI();toast(`${difficulty.label}模式開始！`)
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;if(!paused&&!gameOver){updatePlants(dt);updateProjectiles(dt);updateZombies(dt);updateSuns(dt);updateWaves(dt)}controls.update();renderer.render(scene,camera)}

async function init(){
  buildWorld();updateUI();
  try{await loadNatureModels()}catch(error){console.warn('自然模型載入失敗，遊戲仍可繼續。',error)}
  document.querySelector('#loading').classList.add('done');requestAnimationFrame(loop)
}
init();
