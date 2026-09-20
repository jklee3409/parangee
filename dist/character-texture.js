// Remove only neutral pixels connected to the image border. Enclosed dark eyes
// and mouth remain intact; the original image file and mesh coordinates stay fixed.
export function clearBackdrop(data, width, height) {
  const count=width*height, outside=new Uint8Array(count), queue=new Int32Array(count);
  let head=0,tail=0;
  const visit=index=>{
    if(outside[index])return;
    const p=index*4,r=data[p],g=data[p+1],b=data[p+2];
    if(b-r>=28 || b-g>=18)return;
    outside[index]=1;queue[tail++]=index;
  };
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  // The baked floor shadow seals off the neutral gap between the two feet.
  visit(Math.floor(height*.90)*width+Math.floor(width*.505));
  while(head<tail){
    const i=queue[head++],x=i%width;
    if(x>0)visit(i-1);if(x<width-1)visit(i+1);
    if(i>=width)visit(i-width);if(i<count-width)visit(i+width);
  }
  for(let i=0;i<count;i++){
    const p=i*4;
    const y=Math.floor(i/width);
    const floorShadow=y>height*.84 && (data[p+2]-data[p]<45 || data[p+2]-data[p+1]<25);
    if(outside[i] || floorShadow || y>height*.935){data[p+3]=0;continue;}
    const x=i%width;
    if((x>0&&outside[i-1])||(x<width-1&&outside[i+1])||(i>=width&&outside[i-width])||(i<count-width&&outside[i+width])){
      data[p+3]=Math.round(data[p+3]*Math.max(0,Math.min(1,(data[p+2]-data[p]-14)/36)));
    }
  }
  return data;
}

export function characterTexture(image) {
  const canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  clearBackdrop(pixels.data,canvas.width,canvas.height);
  ctx.putImageData(pixels,0,0);
  canvas.className='texture-fallback';canvas.setAttribute('aria-hidden','true');
  return canvas;
}
