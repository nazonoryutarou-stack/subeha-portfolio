document.body.insertAdjacentHTML('beforeend',String.raw`
<a class="skip" href="#main">本文へ移動</a>
<div class="scan" aria-hidden="true"></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>

<header class="chrome">
  <a class="brand" href="#top"><small>SPIRITUAL OPERATIONS / REPORT 001</small><strong>鴨嘴四十</strong></a>
  <nav aria-label="主要区画">
    <a href="#route">航路</a><a href="#fleet">個体</a><a href="#perimeter">防衛</a><a href="#request">依頼</a>
  </nav>
  <div class="clock"><span>JST</span><time id="clock">--:--:--</time></div>
</header>

<main id="main">
<section class="hero" id="top">
  <canvas id="seaCanvas" aria-hidden="true"></canvas>
  <div class="hero__copy">
    <p class="eyebrow">霊務技術報告 第001号 / DECLASSIFIED</p>
    <h1><span>カモノハシ式神</span><b>四十体</b><em>大阪→横浜<br>海上輸送作戦</em></h1>
    <p class="lead">全高約二メートル。群体同期型。大阪から横浜まで海路で移動し、一人の女性を防衛する任務に就いた。なぜカモノハシなのか。なぜ四十体なのか。なぜ海路なのか。その全記録。</p>
    <div class="hero__actions"><a class="btn primary" href="#route">作戦を追跡する</a><button class="btn ghost" id="playOperation" type="button">作戦再生</button></div>
    <dl class="metrics"><div><dt>投入</dt><dd>40体</dd></div><div><dt>全高</dt><dd>約2m</dd></div><div><dt>移送</dt><dd>海路</dd></div><div><dt>任務</dt><dd>個人防衛</dd></div></dl>
  </div>
  <div class="platypus-stage" aria-label="カモノハシ型式神の模式図">
    <div class="orbit orbit-a"></div><div class="orbit orbit-b"></div>
    <svg class="platypus" viewBox="0 0 760 430" role="img" aria-label="二メートル級カモノハシ式神">
      <defs><linearGradient id="fur" x1="0" x2="1"><stop stop-color="#1a3138"/><stop offset=".55" stop-color="#48666a"/><stop offset="1" stop-color="#101f24"/></linearGradient><linearGradient id="bill"><stop stop-color="#b59662"/><stop offset="1" stop-color="#6c5739"/></linearGradient></defs>
      <ellipse cx="390" cy="225" rx="220" ry="125" fill="url(#fur)" stroke="#a5d4ce" stroke-width="3"/>
      <path d="M205 206C135 164 75 164 28 207c47 43 107 43 177 4" fill="url(#bill)" stroke="#e5c993" stroke-width="3"/>
      <circle cx="214" cy="170" r="9" fill="#dff"/><circle cx="214" cy="170" r="3" fill="#091014"/>
      <path d="M575 220c95-44 148-25 169 12-35 74-110 105-194 84" fill="#7f633f" stroke="#d1b779" stroke-width="3"/>
      <path d="M300 316l-35 65 95-35M465 320l42 60-102-31" fill="#263d42" stroke="#a5d4ce" stroke-width="8" stroke-linecap="round"/>
      <path d="M270 120c70-54 180-54 250 4" fill="none" stroke="#7bf5d2" stroke-width="5" stroke-dasharray="10 12"/>
      <text x="390" y="228" text-anchor="middle" fill="#dce9e5" font-size="32" font-family="monospace">PLT-00 / GROUP MIND</text>
      <g fill="#7bf5d2" font-family="monospace" font-size="18"><text x="32" y="145">電気受容嘴部</text><text x="560" y="120">群体同期背面</text><text x="575" y="360">帰投記憶尾部</text></g>
      <g stroke="#7bf5d2" stroke-width="2"><path d="M145 160L92 148"/><path d="M500 145L590 128"/><path d="M585 300L650 342"/></g>
    </svg>
    <div class="stage-readout"><span>個体規格</span><b>PLATYPUS / 2.0M</b><span>物理質量</span><b>観測不能</b><span>同期率</span><b id="syncReadout">96%</b></div>
  </div>
  <div class="scrollcue">SCROLL TO OPEN OPERATION FILE ↓</div>
</section>

<section class="ticker" aria-hidden="true"><div>海路を選定　／　四十体投入　／　対象者周辺へ環状配置　／　物理的安全を代替しない　／　効果不明も記録　／　海路を選定　／　四十体投入　／　対象者周辺へ環状配置　／　</div></section>

<section class="section brief" id="brief">
<div class="shell split">
  <div class="section-head reveal"><p>00 / OPERATION BRIEF</p><h2>異常な結論には、<br>異常なりの設計がある。</h2></div>
  <div class="prose reveal"><p>相談対象の周辺に、単体の護衛を置くより、相互監視する群体を配置した方がよいと判断した。ただし、人型や猛獣型では攻撃性が先行する。そこで、水陸両用で、電気受容器を持ち、哺乳類でありながら卵を産むという分類不能性を備えたカモノハシ型を採用した。</p><p>四十体は威圧のためではない。交代、外周、内周、偵察、記録、帰投を同時に成立させるための数である。大阪から横浜へ海路を取ったのは、群体の形を崩さず、陸上の人間生活へ過剰に接触しないためだった。</p></div>
</div>
</section>

<section class="section route" id="route">
<div class="shell">
<header class="section-head reveal"><p>01 / ROUTE CONTROL</p><h2>大阪湾から横浜港まで。</h2><span>航路図上の点を選ぶと、各海域の記録と実在の海況APIを確認できる。</span></header>
<div class="route-grid">
  <div class="map-panel reveal">
    <svg id="routeMap" viewBox="0 0 1000 590" role="img" aria-label="大阪から横浜への作戦航路図">
      <defs><filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path class="coast" d="M80 86c114 56 150 95 215 122 72 30 117 12 173 51 66 46 78 116 147 144 86 35 165 0 298 55"/>
      <path class="route-line" id="routeLine" d="M118 148C220 210 263 271 351 318S531 391 629 417 786 460 897 501" pathLength="100"/>
      <g class="route-nodes">
        <button data-point="osaka" aria-label="大阪湾"><circle cx="118" cy="148" r="16"/><text x="145" y="143">大阪湾</text><text x="145" y="165">出発</text></button>
        <button data-point="kii" aria-label="紀伊水道"><circle cx="351" cy="318" r="16"/><text x="378" y="312">紀伊水道</text><text x="378" y="334">隊列再編</text></button>
        <button data-point="enshu" aria-label="遠州灘"><circle cx="629" cy="417" r="16"/><text x="656" y="411">遠州灘</text><text x="656" y="433">外洋巡航</text></button>
        <button data-point="sagami" aria-label="相模湾"><circle cx="810" cy="468" r="16"/><text x="734" y="449">相模湾</text><text x="734" y="470">識別事故</text></button>
        <button data-point="yokohama" aria-label="横浜"><circle cx="897" cy="501" r="18"/><text x="828" y="535">横浜・配置</text></button>
      </g>
      <g id="convoy" filter="url(#glow)"></g>
    </svg>
    <div class="map-controls"><button id="routePrev">← 前区間</button><button id="routeNext">次区間 →</button><span id="routeProgress">00%</span></div>
  </div>
  <aside class="route-data reveal" aria-live="polite"><p class="terminal-label">SELECTED SEA AREA</p><h3 id="pointTitle">大阪湾・出発点</h3><p id="pointText">群体同期を開始。四十体が二列縦隊で湾外へ向かった。</p><dl id="marineData"><div><dt>波高</dt><dd>取得中</dd></div><div><dt>海面温度</dt><dd>取得中</dd></div><div><dt>海流</dt><dd>取得中</dd></div></dl><p class="api-note" id="apiStatus">OPEN-METEO MARINE APIへ接続中。航海判断には使用不可。</p></aside>
</div>
</div>
</section>

`);