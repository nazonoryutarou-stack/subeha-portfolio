document.body.insertAdjacentHTML('beforeend',String.raw`<section class="section documents" id="documents">
<div class="shell">
<header class="section-head reveal"><p>06 / DECLASSIFIED DOCUMENTS</p><h2>公開された内部文書。</h2></header>
<div class="doc-tabs reveal" role="tablist"><button role="tab" aria-selected="true" data-doc="order">命令書</button><button role="tab" aria-selected="false" data-doc="comms">通信記録</button><button role="tab" aria-selected="false" data-doc="post">事後報告</button><button role="tab" aria-selected="false" data-doc="limits">限界事項</button></div>
<article class="document reveal" id="documentBody"></article>
<div class="doc-actions reveal"><button class="btn ghost" id="downloadReport" type="button">作戦報告書を保存</button><button class="btn ghost" id="copySummary" type="button">要約をコピー</button><button class="btn ghost" onclick="window.print()" type="button">印刷する</button></div>
</div>
</section>

<section class="section request" id="request">
<div class="shell request-grid">
  <div class="section-head reveal"><p>07 / INDIVIDUAL APPLICATION</p><h2>この技術を、<br>別の事情へ適用する。</h2><span>配信では概要と実況まで。個別事情の観測、仕様設計、終了条件、記録作成は個別依頼で扱う。</span></div>
  <form class="protocol-form reveal" id="protocolForm">
    <label>案件の呼び名<input name="name" maxlength="40" placeholder="例：玄関周辺の防衛"></label>
    <label>必要な役割<select name="role"><option>防衛</option><option>見張り</option><option>持ち運び</option><option>記録</option><option>距離を置く</option></select></label>
    <label>避けたいこと<textarea name="avoid" maxlength="180" placeholder="怖い外見を避けたい、家族へ影響させたくない等"></textarea></label>
    <button class="btn primary" type="submit">仮仕様を生成する</button>
    <p class="form-note">入力は外部送信されない。生成結果は相談の下書きとして使える。</p>
  </form>
  <aside class="protocol-output reveal" id="protocolOutput"><p class="terminal-label">PROTOCOL PREVIEW</p><h3>未生成</h3><p>役割と制約を入力すると、式神設計の仮仕様が表示される。</p></aside>
</div>
<div class="purchase shell reveal"><div><p class="terminal-label">APPLICATION WINDOW</p><h3>個別式神設計・霊視相談</h3><p>現時点の受付窓口はココナラの電話相談ページ。専用商品が完成後、このリンクを差し替える。</p></div><a class="btn primary" href="https://coconala.com/services/4329584" target="_blank" rel="noopener noreferrer">受付窓口を開く ↗</a></div>
</section>

<section class="section safety" id="safety"><div class="shell"><header class="section-head reveal"><p>08 / SCOPE & SAFETY</p><h2>霊務と、現実の安全を分ける。</h2></header><div class="safety-grid"><article class="reveal"><h3>この記録が扱うもの</h3><p>作者自身の霊視・創作・祭祀実践に基づく観測と設計。式神の物理的存在や効果を証明するものではない。</p></article><article class="reveal"><h3>代替しないもの</h3><p>防犯、警察、医療、法律、避難、専門家への相談。現実の危険がある場合は、そちらを優先する。</p></article><article class="reveal"><h3>販売時の禁止事項</h3><p>必ず守れる、病気が治る、危険が消える、追加購入しないと悪化する、といった保証や恐怖販売は行わない。</p></article></div><p class="marine-credit reveal">海況表示にはOpen-Meteo Marine APIを利用。海岸付近の精度には限界があり、航海判断には使用できない。</p></div></section>
</main>

<footer><div><strong>霊務技術報告001</strong><span>カモノハシ式神四十体・大阪横浜海路輸送作戦</span></div><div><a href="../../">本拠地</a><a href="../">特設ページ一覧</a><button id="motionToggle" type="button">演出を停止</button></div></footer>

`);