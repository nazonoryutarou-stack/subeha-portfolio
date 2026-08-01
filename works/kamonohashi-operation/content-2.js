document.body.insertAdjacentHTML('beforeend',String.raw`<section class="section timeline" id="timeline">
<div class="shell">
<header class="section-head reveal"><p>02 / EVENT LOG</p><h2>実況記録。</h2></header>
<div class="timeline-list">
<article class="reveal"><time>00:00</time><div><h3>大阪湾・投入</h3><p>四十体の同期を確認。先頭四体が嘴部電気受容器を海面へ向ける。</p></div><b>START</b></article>
<article class="reveal"><time>02:18</time><div><h3>紀伊水道・個体17離脱</h3><p>発光する海藻を対象者の信号と誤認。指揮個体03が回収し、隊列へ復帰。</p></div><b>RECOVERED</b></article>
<article class="reveal"><time>05:42</time><div><h3>遠州灘・群体分割</h3><p>波浪に合わせ、四十体を八体×五班へ分割。同期率は94%を維持。</p></div><b>FORMATION B</b></article>
<article class="reveal"><time>08:09</time><div><h3>相模湾・誤認識</h3><p>個体31が民間船を防衛対象と誤認。対象識別規則を再送し、六分後に解除。</p></div><b>FALSE POSITIVE</b></article>
<article class="reveal"><time>10:31</time><div><h3>横浜・環状配置</h3><p>内周十六、外周十六、予備四、記録・衛生四。防衛任務へ移行。</p></div><b>DEPLOYED</b></article>
</div>
</div>
</section>

<section class="section fleet" id="fleet">
<div class="shell">
<header class="section-head reveal"><p>03 / FORTY UNITS</p><h2>四十体、全個体台帳。</h2><span>個体を選ぶと、役割・同期率・性質・事故記録を閲覧できる。</span></header>
<div class="fleet-layout">
  <div class="unit-grid reveal" id="unitGrid" aria-label="式神四十体一覧"></div>
  <aside class="unit-inspector reveal" id="unitInspector"><p class="terminal-label">UNIT INSPECTOR</p><h3>PLT-01「甲板長」</h3><div class="mini-platypus" aria-hidden="true"><i></i><b></b><span></span></div><dl><div><dt>役割</dt><dd>指揮・群体同期</dd></div><div><dt>状態</dt><dd>配置完了</dd></div><div><dt>同期率</dt><dd>98%</dd></div><div><dt>性質</dt><dd>執拗</dd></div></dl><p>異常なし。嘴部の感応板は正常。</p></aside>
</div>
</div>
</section>

<section class="section anatomy" id="anatomy">
<div class="shell">
<header class="section-head reveal"><p>04 / BODY SPECIFICATION</p><h2>なぜ、カモノハシなのか。</h2></header>
<div class="spec-grid">
<article class="reveal"><span>01</span><h3>水陸両用</h3><p>海路で移動し、陸上の対象周辺へそのまま配置できる。輸送形態と任務形態を切り替える必要がない。</p></article>
<article class="reveal"><span>02</span><h3>電気受容</h3><p>嘴部を「微弱な異常の方向を取る感応板」として解釈できる。視覚へ依存しない防衛向きの器官。</p></article>
<article class="reveal"><span>03</span><h3>分類不能性</h3><p>哺乳類、卵生、毒爪、水棲。既存分類の境界へいるため、単一の象徴体系に拘束されにくい。</p></article>
<article class="reveal"><span>04</span><h3>攻撃性の低さ</h3><p>猛獣の威圧ではなく、異様な物量で守る。対象者自身を怖がらせず、周囲へだけ違和感を残す。</p></article>
</div>
<div class="formation reveal"><div class="formation__viz" id="formationViz" aria-label="四十体の隊列図"></div><div><p class="terminal-label">FORMATION LOGIC</p><h3>八体×五班、または二重環。</h3><p>移動中は五班へ分割し、波浪や障害物へ対応する。到着後は内周十六体、外周十六体、予備四体、衛生・記録四体へ再編する。</p><button class="btn ghost" id="formationToggle" type="button">隊列を切り替える</button></div></div>
</div>
</section>

<section class="section perimeter" id="perimeter">
<div class="shell">
<header class="section-head reveal"><p>05 / DEFENSE PERIMETER</p><h2>一人を、四十体で囲む。</h2><span>下図は概念上の配置。対象者の現在地や個人情報は表示しない。</span></header>
<div class="perimeter-board reveal">
  <div class="rings" id="rings"><div class="target"><span>対象</span><b>匿名</b></div></div>
  <aside><p class="terminal-label">ACTIVE SECTOR</p><h3 id="sectorTitle">全周監視</h3><p id="sectorText">内周は接近検知、外周は方向把握、予備隊は穴埋めと追跡を担当する。</p><div class="threat-bars"><label>接近異常<i><b style="--v:32%"></b></i></label><label>群体同期<i><b style="--v:96%"></b></i></label><label>誤認識率<i><b style="--v:7%"></b></i></label></div></aside>
</div>
</div>
</section>

`);