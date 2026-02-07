# スナップショットの使い方

## スナップショットから起動して中身を見る手順

### 1. スナップショットからサンドボックスを作成

```bash
# snapshot-id.txt に保存された ID を使う場合
SNAPSHOT_ID=$(cat scripts/snapshot-id.txt)
sandbox create --snapshot "$SNAPSHOT_ID" --timeout 30m
```

出力に表示される Sandbox ID（`sbx_xxxxx`）をメモする。

### 2. サンドボックスに接続（対話シェル）

```bash
sandbox connect sbx_XXXXXXXX
# または
sandbox exec --interactive --tty sbx_XXXXXXXX bash
```

`sbx_XXXXXXXX` は手順 1 で表示された Sandbox ID に置き換える。

### 3. 中身を確認する

接続後、作業ディレクトリは `/vercel/sandbox`。リポジトリは `repo/` にクローン済み。

```bash
pwd                    # /vercel/sandbox
ls -la                 # create-base-snapshot.sh, repo/ など
cd repo                # クローンしたリポジトリ（staging ブランチ）
cd frontend && ls      # 依存関係インストール済み
which opencode         # ~/.local/bin/opencode
which gh               # ~/.local/bin/gh
```

### 4. 終了したらサンドボックスを停止

```bash
exit                   # シェルから抜けたあと
sandbox stop sbx_XXXXXXXX
```

---

## スナップショット作成の流れ（参考）

```bash
./scripts/run-create-snapshot-via-cli.sh
# 対話で REPO_URL / BASE_BRANCH / GitHub token 等を入力
# 完了後、scripts/snapshot-id.txt に Snapshot ID が保存される
```

---

## トラブルシュート: lock と package.json の不一致

- **pnpm 利用時**（`pnpm-lock.yaml` がある）: スクリプトは `pnpm install --frozen-lockfile` を実行し、失敗時は `pnpm install` にフォールバックします。
- **npm 利用時**: `package.json` に依存を足したあと `package-lock.json` を更新していないと `npm ci` が失敗することがあります（例: `Missing: opencode-ai@1.1.53 from lock file`）。失敗時は自動で `npm install` にフォールバックします。

**恒久対応（リポジトリ側）:**

```bash
# pnpm の場合
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: sync pnpm-lock.yaml"
git push

# npm の場合
npm install
git add package-lock.json
git commit -m "chore: sync package-lock.json with package.json"
git push
```

再現性を上げるには lock ファイルの同期・コミットを推奨します。
