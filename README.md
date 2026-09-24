# kamiiso-v3

カミイソ産商 採用サイト（静的サイト / Vite）。

## 必要環境

- Node.js 18 以上
- npm（Node.js に同梱）

## セットアップ

ZIP を解凍したら、プロジェクトのルート（この README があるフォルダ）で以下を実行します。

```bash
# 1. 依存関係をインストール
npm install

# 2. 開発サーバーを起動（http://localhost:3000）
npm run dev
```

## 本番ビルド

```bash
# dist/ に本番用ファイルを出力
npm run build

# ビルド結果をローカルでプレビュー
npm run preview
```

`npm run build` を実行すると、画像・CSS・JS が最適化されて `dist/` フォルダに出力されます。この `dist/` フォルダの中身をそのまま任意の静的ホスティング（Vercel、Netlify、S3 など）に配置すれば公開できます。

## ディレクトリ構成

```
.
├── index.html            # ページ本体
├── assets/
│   ├── css/              # スタイル（site.css ほか）
│   ├── js/               # スクリプト（site.js）
│   └── images/           # 画像アセット
├── vite.config.js        # Vite 設定
└── package.json
```

## テストサーバーでのOGP確認

テストサイトは `https://kamiiso-design.vercel.app/` です。`vercel.json` のビルドコマンドにこのURLを設定しているため、Vercelへのデプロイ時にOGP画像の参照先が `https://kamiiso-design.vercel.app/assets/images/OGP.jpg` になります。

公開先のURLを `SITE_URL` に指定してビルドすると、OGP・Twitterカードの画像URL、ページURL、canonicalがその公開先に揃います。サブディレクトリを含む場合は、そのパスまで指定してください。

```bash
SITE_URL=https://kamiiso-design.vercel.app/ npm run build
```

または `.env.staging` に `SITE_URL=https://kamiiso-design.vercel.app/` を記入し、`npm run build -- --mode staging` を実行してください。Vercel以外でURLを未指定の場合は本番URL（`https://www.kamiiso.co.jp/recruit/`）になります。

生成した `dist/` の中身をテストサーバーの公開先に配置します。画像は `assets/images/OGP.jpg` に出力され、メタタグはJavaScript実行前のHTMLに含まれます。公開後はページのソースで `og:image` を確認し、そのURLで画像を取得できることを確認してください。
