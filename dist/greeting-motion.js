// A continuous original-texture greeting: curious tilt, two soft head turns,
// a smiling pause, then a small bow. No cutouts, replacement pixels or new limbs.
export const GREETING_DURATION = 3.6;
export const restingGreeting = () => ({ roll: 0, turn: 0, nod: 0, smile: 0, blink: 0, blush: 0, tilt: 0, squash: 0 });
const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const fade = (a, b, value) => smooth((value - a) / (b - a));
const track = (time, keys) => {
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [end, to] = keys[i], [start, from] = keys[i - 1];
    if (time <= end) return from + (to - from) * fade(start, end, time);
  }
  return keys[keys.length - 1][1];
};

// Unequal arcs and a brief affectionate hold avoid a repeating metronome motion.
const ROLL = [[0,0],[.95,.004],[1.95,-.004],[2.80,.002],[3.6,0]];
// Yaw in radians: turn around the neck's vertical axis, rather than sliding.
const TURN = [[0,0],[.15,0],[.95,.05],[1.95,-.045],[2.80,.025],[3.6,0]];
const NOD = [[0,0],[.23,.002],[.58,-.003],[1.75,-.002],[2.04,0],[2.40,.009],[2.82,-.001],[3.6,0]];
const SMILE = [[0,0],[.45,.55],[1.55,.85],[2.18,1],[2.65,.8],[3.6,0]];
const BLINK = [[0,0],[1.99,0],[2.22,.62],[2.33,.62],[2.63,0],[3.6,0]];
const BLUSH = [[0,0],[.38,.35],[.8,.8],[1.65,1],[2.65,.7],[3.6,0]];

function headDepth(x, y) {
  const u=(x-.506)/.20, v=(y-.346)/.18;
  const roundness=Math.max(0,1-u*u-v*v);
  const nose=Math.exp(-(((x-.506)/.044)**2)-((y-.365)/.052)**2);
  return .115*roundness**1.5 + .024*nose;
}
const eyeDepths = [.431,.580].map(x => ({ x, depth: headDepth(x,.337) }));

export function greetingPose(seconds, reduced = false) {
  if (seconds <= 0 || seconds >= GREETING_DURATION) return restingGreeting();
  const movement = reduced ? .2 : 1;
  return {
    roll: track(seconds, ROLL) * movement,
    turn: track(seconds, TURN) * movement,
    nod: track(seconds, NOD) * movement,
    smile: track(seconds, SMILE),
    blink: track(seconds, BLINK) * (reduced ? .35 : 1),
    blush: track(seconds, BLUSH),
    // Only the head performs the greeting; keep shoulders and torso at rest.
    tilt: 0,
    squash: 0,
  };
}

export function deformGreeting(x, y, pose, aspect = 1327 / 1186) {
  if (!pose || !(pose.roll || pose.turn || pose.nod || pose.smile || pose.blink)) return [x, y];
  let fx = x, fy = y;
  // Lift only the original mouth corners and cheeks, retaining its W-shaped smile.
  for (const cx of [.452, .561]) {
    const mouth = Math.exp(-(((x-cx)/.034)**2) - ((y-.407)/.025)**2);
    fy -= pose.smile * .0045 * mouth;
  }
  // Compress the existing glossy eyes gently, rather than drawing a new face.
  for (const cx of [.431, .580]) {
    const eye = Math.exp(-(((x-cx)/.030)**4) - ((y-.337)/.032)**4);
    fy -= (y-.337) * (pose.smile*.12 + pose.blink) * eye;
  }
  const neck = 1-fade(.435,.515,y);
  const head = fade(.09,.18,y) * neck * fade(.16,.30,x) * (1-fade(.688,.738,x));
  // Project the original texture on a shallow, rounded head surface. The nose
  // sits forward of the cheeks: yaw changes near/far eye size and nose position.
  // A smooth depth profile avoids folds at the outline; no unseen pixels are invented.
  let depth=headDepth(fx,fy);
  // Keep the glossy eyes rounded instead of stretching them with the soft cheek.
  for (const eye of eyeDepths) {
    const rigidity=.42*Math.exp(-(((fx-eye.x)/.027)**4)-((fy-.337)/.030)**4);
    depth+=(eye.depth-depth)*rigidity;
  }
  const horizontal=(fx-.506)*aspect;
  const yawCos=Math.cos(pose.turn),yawSin=Math.sin(pose.turn);
  const rotatedX=horizontal*yawCos+depth*yawSin;
  const rotatedZ=depth*yawCos-horizontal*yawSin;
  const perspective=1+((.85-depth)/(.85-rotatedZ)-1)*.15;
  const projectedX=.506+rotatedX*perspective/aspect;
  const projectedY=.346+(fy-.346)*perspective;
  // Keep the original silhouette intact; hint at yaw only within the soft face.
  const faceTurn=head*fade(0,.045,depth);
  fx+=(projectedX-fx)*faceTurn;
  fy+=(projectedY-fy)*faceTurn;
  const dx=(fx-.51)*aspect, dy=fy-.465;
  const cos=Math.cos(pose.roll),sin=Math.sin(pose.roll);
  fx += ((dx*(cos-1)-dy*sin)/aspect) * head;
  fy += (dx*sin+dy*(cos-1)+pose.nod) * head;
  return [fx,fy];
}

// Blush lives on a separate transparent layer; the source image stays untouched.
// Local deformed axes attach each soft oval to its cheek throughout the head turn.
export function drawCheekBlush(ctx, model, breath) {
  ctx.clearRect(0, 0, model.width, model.height);
  const amount = model.greeting?.blush || 0;
  if (amount <= 0) return;
  for (const cx of [.387, .624]) {
    const center=model.deform(cx,.388,breath);
    const right=model.deform(cx+.036,.388,breath);
    const down=model.deform(cx,.388+.023,breath);
    ctx.save();
    ctx.setTransform(right[0]-center[0],right[1]-center[1],down[0]-center[0],down[1]-center[1],center[0],center[1]);
    const gradient=ctx.createRadialGradient(0,0,0,0,0,1);
    gradient.addColorStop(0,`rgba(255,147,175,${.42*amount})`);
    gradient.addColorStop(.38,`rgba(255,153,182,${.28*amount})`);
    gradient.addColorStop(.72,`rgba(255,162,190,${.10*amount})`);
    gradient.addColorStop(1,'rgba(255,162,190,0)');
    ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
}
