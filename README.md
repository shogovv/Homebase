# Homebase

Chrome の固定タブを Arc のように使える拡張機能。

## 概要

- **リロードで「ホーム」に戻る** — ピン留めタブをリロード（⌘R / Ctrl+R）するだけで、固定URLに自動復帰
- **Arc の固定タブを Chrome で再現** — Arc のようにタブごとに「居場所」を持たせ、迷子にならない
- **自由にブラウジング、いつでもリセット** — ピン留めタブ内の移動は一切ブロックしない。戻りたいときだけリロード

## インストール

> Chrome Web Store への公開版は準備中です。現在は手動インストールのみ。

1. このリポジトリを ZIP でダウンロードして展開、または `git clone`
2. Chrome で `chrome://extensions` を開く
3. 右上の **「デベロッパーモード」** をオンにする
4. **「パッケージ化されていない拡張機能を読み込む」** をクリック
5. `homebase` フォルダを選択

## 使い方

| 操作 | 動作 |
|---|---|
| タブを右クリック → **「Pin Tab」** | 現在の URL を固定URLとして登録 |
| ピン留めタブで別 URL に移動 | 自由に移動できる（ブロックされない） |
| ピン留めタブをリロード（⌘R） | 固定 URL に戻る |
| 拡張機能アイコンをクリック | ポップアップで固定 URL 一覧を管理 |
| ポップアップ → **「更新」** | 現在の URL を新しい固定 URL に変更 |
| ポップアップ → **「解除」** | そのタブの固定を解除 |
| ピン留めを外す | 固定 URL も自動削除 |

## 仕組み

- タブがピン留めされた瞬間に、その URL を `chrome.storage.session`（ランタイム用）と `chrome.storage.local`（永続用）に記録
- `chrome.webNavigation.onCommitted` でリロード（`transitionType === "reload"`）を検知
- リロード時に現在 URL が固定 URL と異なる場合だけリダイレクト
- 通常の URL 移動はまったく干渉しない
- ブラウザ再起動時も固定 URL は保持される（タブの現在URLをもとに再マッチング）

## ライセンス

MIT

---

# Homebase (English)

A Chrome extension that makes pinned tabs work like Arc browser.

## Overview

- **Reload to go "home"** — Simply reload a pinned tab (⌘R / Ctrl+R) to return to its fixed URL
- **Arc-style pinned tabs for Chrome** — Give each tab a "home base" so you never lose track
- **Browse freely, reset anytime** — Navigation within pinned tabs is never blocked. Just reload when you want to go back

## Installation

> Chrome Web Store release is coming soon. Manual installation only for now.

1. Download this repository as ZIP and extract, or `git clone`
2. Open `chrome://extensions` in Chrome
3. Enable **"Developer mode"** in the top right
4. Click **"Load unpacked"**
5. Select the `homebase` folder

## Usage

| Action | Behavior |
|---|---|
| Right-click a tab → **"Pin Tab"** | Registers the current URL as the fixed URL |
| Navigate to another URL in a pinned tab | Free navigation (not blocked) |
| Reload a pinned tab (⌘R) | Returns to the fixed URL |
| Click the extension icon | Manage fixed URLs in the popup |
| Popup → **"Update"** | Set the current URL as the new fixed URL |
| Popup → **"Remove"** | Remove the fixed URL for that tab |
| Unpin the tab | Fixed URL is automatically removed |

## How it works

- When a tab is pinned, its URL is saved to `chrome.storage.session` (runtime) and `chrome.storage.local` (persistent)
- Detects reloads via `chrome.webNavigation.onCommitted` (`transitionType === "reload"`)
- Redirects only when the current URL differs from the fixed URL on reload
- Normal URL navigation is never intercepted
- Fixed URLs are preserved across browser restarts (re-matched by tab URL)

## License

MIT
