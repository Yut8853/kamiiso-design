# Edge-to-Edge修正・検証報告

対象: https://kamiiso-design.vercel.app/  
作業日: 2026-10-05（日本時間）  
状態: ローカル実装・自動検証済み。未デプロイ。Android Chrome／iOS Safariの実機・ブラウザー描画検証は未実施のため、受入完了とはしていません。

## 1. 修正前の未対応箇所

静的HTML + Vite構成。CSSは共通設定、リセット、サイト固有スタイル、粒子スタイルに分かれ、JavaScriptがメニュー・タブ・ポップアップ・KVを制御しています。React／JSX／TSX、フォーム、独立したモーダル、画面下固定CTAはありません。

- viewportに`viewport-fit=cover`が未指定。
- Safe Areaの共通設定がなく、ヘッダー・本文・CTA・フッター・ドロワーが固定の余白のみ。
- ドロワーが固定配置の`inset: 0`と割合高に依存し、Safe Areaを除いた操作領域が未定義。
- 読込進捗表示が`100vw`基準で、短い横画面では下端を超え得る位置指定。
- キーワードの位置計算がSafe Areaを無視し、SPの表示面積が少ないときに画面外まで許容するフォールバックが存在。
- 全幅写真が左右25pxの固定打消しに依存。

## 2. 修正ファイル

| ファイル | 内容 |
|---|---|
| `index.html` | 既存viewportへ`viewport-fit=cover`を統合 |
| `assets/css/properties.css` | 四方向のSafe Area、動的・小さいviewport高の共通変数 |
| `assets/css/reset.css` | アンカー移動時の上余白にSafe Areaを加算 |
| `assets/css/site.css` | 共通コンテンツ余白、ヘッダー、KV開始位置、ドロワー、フッター、読込表示、全幅写真 |
| `assets/js/site.js` | ポップアップの安全領域計算への接続、端でのタップ時のスクロール、サイズ変化の監視 |
| `assets/js/viewport.js` | Safe AreaとVisualViewportの交差領域、ポップアップ配置の共通計算（新規） |
| `tests/edge-to-edge.test.mjs` | 位置・開閉処理の回帰テスト（新規） |
| `docs/edge-to-edge-review.md` | 本報告 |

## 3. HTML / CSS / JavaScriptの変更

HTMLのviewportは1件のみです。拡大操作は制限していません。

```html
<meta name="viewport" id="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

共通の`--safe-area-top/right/bottom/left`に、対応する`env(safe-area-inset-*, 0px)`を定義しました。既存のブレークポイントごとの余白は`--content-gutter`として保持し、コンテンツ用コンテナーで左右のSafe Areaを加算しています。本文内の入れ子すべてに加算する方式にはしていません。

ポップアップは「キーワード枠」「実際に見えているviewport」「Safe Area」「固定ヘッダーより下」の交差領域に収めます。長文はカード内でスクロールします。画面端でタップした場合は、必要なときだけキーワードを画面内へスクロールして表示領域を確保します。

## 4. viewport単位の扱い

- ドロワー: `height: var(--viewport-height)`とし、対応環境では`100dvh`。ブラウザーUIの変化に追従。
- 読込表示: `18vh`相当の位置計算を`100svh`由来へ変更し、下端は`100dvh`とSafe Areaで制限。
- KV背景: 前回修正した`min-height: 100lvh`を維持。これは操作UIではなく背景で、バーが隠れた最大表示領域まで覆うための意図的な指定。
- KV本体: 既存のPC側`max(100svh, 900px)`、SP側の固定構図用最低高は維持。
- 残る`100vh`: 共通変数とKV背景の旧ブラウザー用フォールバックのみ。現行対応ブラウザーでは`dvh`／`svh`／`lvh`が適用されます。

## 5. Safe Areaを追加した箇所

- ヘッダー: 背景を端まで残し、上部の内側余白にSafe Areaを加算。左右のロゴ・メニューボタンも保護。
- KV: コンテンツ開始位置に上Safe Area、コピー用コンテナーに左右Safe Area。背景・装飾は全幅。
- 通常セクションとエントリーCTA: 既存の左右余白へSafe Areaを加算。
- フッター: 既存の上下余白を維持し、下側のみSafe Areaを追加。背景は画面端まで白。
- ドロワー: ヘッダー下の開始位置、左右余白、スクロール領域末尾にSafe Areaを反映。
- 読込進捗: 四方向のSafe Areaと短い画面高を考慮。
- キーワードポップアップ: CSSと同じSafe Area値をJSで読み取り、表示範囲に反映。
- アンカー／フォーカス移動: 上部スクロール余白と下部スクロール安全領域を追加。

## 6. fixed / sticky監査

| 要素 | 対応 |
|---|---|
| 固定ヘッダー | 上・左右Safe Area。閉じるボタンを含む操作部分を保護 |
| 固定ドロワー | `100dvh`、安全な内部スクロール領域。高さ変更を遅延させないようtransitionはopacityのみ |
| 固定KV背景 | `100lvh`の全幅背景を維持。前回追加したResizeObserverによるCanvas追従を維持 |
| 固定ローダー背景／写真の演出 | 装飾なので画面全体を覆う設定を維持 |
| 固定読込進捗 | 安全領域内に位置・幅を制限 |
| ローディング中のbody固定 | 既存のスクロールロックと解除処理を維持 |
| `.environment-copy`のsticky指定 | 上Safe Areaを加算。ただし現行デザインでは後段の既存ルールでrelativeに上書きされ、stickyは無効 |
| 下部固定CTA | 現在のサイトには存在しない。エントリーCTAは通常フロー内 |

## 7. 横はみ出しの監査

読込進捗の幅を`100vw`から包含領域の`100%`へ変更し、左右Safe Areaも差し引きました。

「働く環境」の全幅写真は、固定の`-25px`ではなく、実際のコンテンツ余白とSafe Areaを打ち消す幅・左右marginへ変更。Safe Area加算後も写真は画面端に一致する計算です。

募集要項の横スクロールはタブ内部に限定する既存設定を維持。本文は共通コンテナー内です。装飾の回転・画面外配置と既存の横方向clipは維持し、新たな全ページoverflow非表示で不具合を隠していません。

残る`width: 100vw`は現行HTMLで使用していないインタビュー別案（`data-interview-view='focus'`）の指定です。現在は`bento`を使用しています。残る`vw`には文字間隔・装飾サイズなどがあり、文字間隔には左右Safe Areaを反映しました。

ページ全体の`scrollWidth`をブラウザー上で計測する検証は未実施です。

## 8. PC／タブレットへの影響

Safe Areaが0の場合は元の余白と同じ計算になります。320 / 393 / 767 / 768 / 1024 / 1440pxの各幅で、7種の主要コンテナーの上下左右paddingを修正前CSSと静的に比較し、42組で一致しました。フォント・画像・既存ブレークポイントの変更はありません。

短い画面で読込進捗が下に切れるケースはPCも含めて補正対象です。画面全体の見た目の回帰確認は未実施です。

## 9. Android Chromeの確認結果

実機／エミュレーター／接続ブラウザーがないため、最新版Chrome、Pixel、実際のジェスチャーナビゲーションでの確認は未実施です。

代わりに、下24pxの安全領域、左右非対称の安全領域、縦横回転、viewport高の変化を入力した位置計算テストが成功しました。これは端末の描画・操作性の検証を代替するものではありません。

## 10. iOS Safariを想定した確認結果

実機／Safariブラウザー上の確認は未実施です。

上59px・下34px、横向き左右59px・下21pxなどの想定入力で、ヘッダー下・安全領域・キーワード枠内の配置を確認。VisualViewport縮小や拡大時にSafe Areaを二重加算しないテストも成功しました。数値はテスト用の入力で、すべてのiPhoneの実測値を表すものではありません。

## 自動検証

```sh
node --test tests/edge-to-edge.test.mjs
node --check assets/js/site.js
node --check assets/js/viewport.js
npm run build
```

7テスト成功（ポップアップ配置189条件、画面端でのタップ・再タップ・外側タップ、Safe Area更新を含む）。CSS構文解析成功。修正前との余白比較42組一致。ビルド成功。既存のJSチャンクサイズ警告は継続しています。

## 実機で残る受入確認

Android Chrome（Pixel・ジェスチャーナビ）とiPhone Safari（Dynamic Island／ホームインジケーター）で、縦・横それぞれ次を確認してください。現時点ではすべて未実施です。

1. KVでブラウザーのバーを出し入れし、背景下端の途切れや不自然な余白がない。
2. メニューを開閉し、閉じるボタンを押せる。メニュー最下部のCTAまでスクロールでき、ジェスチャーバーに隠れない。
3. キーワード15個をタップし、長文のスクロール、画面端・回転後の配置が正常。
4. 募集要項の長い職種名を横スクロールで選べる。ページ全体には不要な横スクロールがない。
5. フッター最下部・エントリーCTA・アンカー移動先が安全領域に収まり、操作できる。
6. PCとタブレットで既存デザインを比較する。

実装の参考: [Chrome公式Edge-to-Edgeガイド](https://developer.chrome.com/docs/css-ui/edge-to-edge)、[WebKit公式Safe Areaガイド](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)。固定下部バーの新設はしていません。
