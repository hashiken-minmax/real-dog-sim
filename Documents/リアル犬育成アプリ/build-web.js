/**
 * Web ビルドスクリプト
 *
 * `npx expo export` は出力先に既存の index.html があると、それをHTMLテンプレート
 * として再利用する。そのため前回ビルドで埋め込まれた AppEntry の <script> タグが
 * 残ったまま新しいタグが追記され、古いJSバンドルが読み込まれる（スマホ等で旧版が
 * 表示される）不具合が起きていた。
 *
 * これを防ぐため、ビルド前に public/ を完全に削除してからクリーンにエクスポートする。
 * public/ は Vercel が配信するフォルダで、これが唯一のビルド成果物。
 *
 * 使い方:  npm run build:web
 */
const { execSync } = require('child_process');
const fs = require('fs');

// 前回ビルド成果物を削除。
// public/ を残すと Expo が古い index.html をテンプレートとして再利用し、
// AppEntry の <script> タグが二重化して旧版が読み込まれる不具合が起きる。
fs.rmSync('public', { recursive: true, force: true });
fs.rmSync('dist', { recursive: true, force: true });

// 最新の App.tsx から Web バンドルを生成（出力先 dist/）
execSync('npx expo export --platform web --output-dir dist --clear', { stdio: 'inherit' });

// dist/ を配信フォルダ public/ にリネーム（高速・ディープコピー不要）
fs.renameSync('dist', 'public');

console.log('\n✅ Web build complete — public/ を更新しました。');
