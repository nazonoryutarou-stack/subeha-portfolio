/* Three-band WebAudio EQ. No external packages or network requests. */
export const EQ_LIMIT = 12;
export const EQ_BANDS = Object.freeze([
  {name:'bass',type:'lowshelf',frequency:180,Q:0.707},
  {name:'mid',type:'peaking',frequency:1100,Q:0.8},
  {name:'treble',type:'highshelf',frequency:4300,Q:0.707},
]);
export function normalizeEQ(value={}) {
  const input = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const band of EQ_BANDS) {
    const n = Number(input[band.name]);
    result[band.name] = Number.isFinite(n) ? Math.max(-EQ_LIMIT, Math.min(EQ_LIMIT, n)) : 0;
  }
  return result;
}
export function installTrackEQ(ctx,source,gain,destination,mixer) {
  const filters=EQ_BANDS.map(b=>{
    const node=ctx.createBiquadFilter();node.type=b.type;node.frequency.value=b.frequency;node.Q.value=b.Q;node.gain.value=0;return node;
  });
  source.connect(filters[0]);
  for(let i=1;i<filters.length;i++)filters[i-1].connect(filters[i]);
  filters.at(-1).connect(gain);
  gain.connect(destination);
  if(mixer)gain.connect(mixer);
  const update=(settings)=>{
    const eq=normalizeEQ(settings);
    for(let i=0;i<filters.length;i++)filters[i].gain.value=eq[EQ_BANDS[i].name];
  };
  return {filters,update};
}
