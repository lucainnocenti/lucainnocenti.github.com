// Checks the worker numerics embedded in visualizations/qelm-triple-descent.html against qelm-js.
// Run from the repository root:  QELM_LIBRARY=/path/to/qelm-js/src/index.js node --test
// QELM_LIBRARY defaults to a qelm-js checkout next to this repository (../qelm-js).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const libraryUrl=process.env.QELM_LIBRARY?pathToFileURL(process.env.QELM_LIBRARY):new URL('../../qelm-js/src/index.js',import.meta.url);
const library=await import(libraryUrl);
const {Random,randomIsometry,randomPureState,frameProbabilities,fitReadout,stateCoordinates,effectCoordinates}=library;
const html=await readFile(new URL('../visualizations/qelm-triple-descent.html',import.meta.url),'utf8');
const source=html.match(/<script id="workerSource" type="text\/plain">([\s\S]*?)<\/script>/)[1];
// The page hands the worker the whole library; do the same here.
const {solvePseudo,predictStats}=vm.runInNewContext(source+'\n({solvePseudo,predictStats})',{...library});
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('direct SVD ridge agrees with independent ridge solutions, tall and wide',()=>{
  const matrices=[[[1,2],[2,1],[1,-1]],[[1,2,0],[0,1,1]],[[1,1],[2,2]]];
  for(const X of matrices) for(const ridge of [0,.01,1,10]){
    const y=X.map((_,i)=>i+1), expected=fitReadout(X,y,{lambda:ridge}),actual=solvePseudo(X,y,1e-10,ridge);
    expected.weights.forEach((v,i)=>near(actual.w[i],v,1e-7));
  }
});
test('conditional Haar average agrees with independent Monte Carlo for nonzero ridge and label noise',()=>{
  const rng=new Random(321), d=2, Q=randomIsometry(4,d,rng);
  const states=Array.from({length:3},()=>randomPureState(d,rng)), features=states.map(stateCoordinates), X=states.map(s=>frameProbabilities(Q,s));
  const ridge=.1, gamma=.2, M=60, frame=effectCoordinates(Q);
  const exact=solvePseudo(X,null,1e-10,ridge,{...frame,trainingFeatures:features,d,gamma,M},X.length);
  let bias=0,shot=0;const trials=16000;
  for(let i=0;i<trials;i++){
    const target=randomPureState(d,rng),sigma=randomPureState(d,rng),tf=stateCoordinates(target),sf=stateCoordinates(sigma);
    const dot=(a,b)=>a.reduce((sum,v,k)=>sum+v*b[k],0);
    const y=features.map(f=>dot(f,tf)+gamma*rng.normal());
    const fit=solvePseudo(X,y,1e-10,ridge),p=frameProbabilities(Q,sigma),truth=dot(tf,sf),stats=predictStats(fit.w,p,truth,M);
    bias+=stats.bias/trials;shot+=stats.shot/trials;
  }
  near(bias,exact.bias,.004);near(shot,exact.shot,.0003);
});
