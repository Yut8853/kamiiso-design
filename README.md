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
