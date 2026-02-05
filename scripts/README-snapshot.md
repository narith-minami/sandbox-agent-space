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
