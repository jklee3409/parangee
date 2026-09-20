import test from 'node:test';
import assert from 'node:assert/strict';
import { clearBackdrop } from '../dist/character-texture.js';

test('background becomes transparent while enclosed eyes and original colors survive',()=>{
  const width=100,height=100,data=new Uint8ClampedArray(width*height*4);
  const set=(x,y,color)=>data.set(color,(y*width+x)*4);
  const pixel=(x,y)=>Array.from(data.slice((y*width+x)*4,(y*width+x)*4+4));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)set(x,y,[190,192,198,255]);
  for(let y=20;y<80;y++)for(let x=25;x<75;x++)set(x,y,[20,100,185,255]);
  set(40,35,[15,15,15,255]);set(60,35,[240,240,240,255]);
  clearBackdrop(data,width,height);
  assert.equal(pixel(0,0)[3],0);
  assert.equal(pixel(90,50)[3],0);
  assert.deepEqual(pixel(40,35),[15,15,15,255]);
  assert.deepEqual(pixel(60,35),[240,240,240,255]);
  assert.deepEqual(pixel(50,60),[20,100,185,255]);
});

test('floor shadows are removed without removing blue feet',()=>{
  const width=100,height=100,data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++)data.set([20,100,185,255],i*4);
  data.set([85,100,120,255],(90*width+50)*4);
  clearBackdrop(data,width,height);
  assert.equal(data[(90*width+50)*4+3],0);
  assert.equal(data[(90*width+40)*4+3],255);
  assert.equal(data[(97*width+40)*4+3],0);
});
