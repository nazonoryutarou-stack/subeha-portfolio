import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const repoRoot = path.resolve(projectRoot, '..', '..');
const goldenPath = path.join(repoRoot, 'docs', 'vtuber-golden-reference-v1.json');
const vrmPath = path.join(repoRoot, 'Subeha.vrm');
const vrmSourcePath = path.join(projectRoot, 'src', 'VrmLipSyncV3.tsx');
const studioSourcePath = path.join(projectRoot, 'src', 'VrmLipSyncStudio.tsx');

const fail = (message) => {
  console.error(`GOLDEN CONTRACT FAIL: ${message}`);
  process.exit(1);
};

for (const file of [goldenPath, vrmPath, vrmSourcePath, studioSourcePath]) {
  if (!fs.existsSync(file)) fail(`missing ${file}`);
}

const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
if (golden?.version !== 1 || golden?.locked !== true) fail('golden reference metadata is not locked v1');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const actualVrmSha = sha256(vrmPath);
if (actualVrmSha !== golden.hashes?.vrmSha256) {
  fail(`Subeha.vrm SHA changed: ${actualVrmSha} != ${golden.hashes?.vrmSha256}`);
}

const vrmSource = fs.readFileSync(vrmSourcePath, 'utf8');
const studioSource = fs.readFileSync(studioSourcePath, 'utf8');

const requiredVrmSnippets = [
  "if (landscape) vrm.scene.rotation.y = -Math.PI / 12;",
  "const targetHeight = fs.y * (landscape ? 0.34 : 0.84);",
  "const targetCenterY = landscape ? framed.max.y - targetHeight * 0.47 + fs.y * 0.012 : framed.max.y - targetHeight * 0.56 - fs.y * 0.01;",
  "const rightZoneCenter = 1 - (0.45 / 2);",
  "vrm.scene.position.x += (rightZoneCenter - 0.5) * horizontalSpan;",
  "if (vrm.meta.metaVersion === '0') VRMUtils.rotateVRM0(vrm);",
];
for (const snippet of requiredVrmSnippets) {
  if (!vrmSource.includes(snippet)) fail(`renderer drifted from golden layout: ${snippet}`);
}

const requiredStudioSnippets = [
  "left:'57%'",
  "position:'absolute',zIndex:5,left:44,top:102,width:620,height:444",
  "transform:`translateX(-${slide}px) scale(${0.985 + reveal * .015})`",
  "transformOrigin:'center left'",
];
for (const snippet of requiredStudioSnippets) {
  if (!studioSource.includes(snippet)) fail(`studio drifted from golden layout: ${snippet}`);
}

if (golden.render?.width !== 1280 || golden.render?.height !== 720) fail('golden output size changed');
if (golden.render?.vrmYawDegrees !== -15) fail('golden VRM yaw changed');
if (golden.render?.landscapeVisibleBodyFraction !== 0.34) fail('golden bust-up fraction changed');
if (golden.qualityContract?.vrmOnRight !== true || golden.qualityContract?.visualOnLeft !== true) fail('golden side contract changed');
if (golden.qualityContract?.vrmFacesFrameCenter !== true) fail('golden facing contract changed');

console.log(JSON.stringify({
  ok: true,
  golden: golden.name,
  renderCommitSha: golden.renderCommitSha,
  vrmSha256: actualVrmSha,
  layout: golden.render.layout,
  size: `${golden.render.width}x${golden.render.height}`,
  yawDegrees: golden.render.vrmYawDegrees,
  visibleBodyFraction: golden.render.landscapeVisibleBodyFraction,
}, null, 2));
