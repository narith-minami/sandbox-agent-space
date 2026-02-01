# システム構成図

## 全体アーキテクチャ

```mermaid
flowchart TB
    subgraph Client["クライアント層"]
        Browser["ブラウザ"]
    end

    subgraph NextJS["Next.js 16 Application"]
        subgraph Frontend["フロントエンド"]
            React["React 19 Components"]
            TanStack["TanStack Query"]
            Hooks["Custom Hooks"]
            UI["shadcn/ui"]
            Storage["LocalStorage"]
        end

        subgraph BackendAPI["バックエンド API"]
            APISandbox["/api/sandbox/*"]
            APISessions["/api/sessions"]
            APISnapshots["/api/snapshots/*"]
            APIConfig["/api/config"]
        end

        subgraph BusinessLogic["ビジネスロジック"]
            SandboxManager["SandboxManager"]
            DBQueries["Database Queries"]
            Validators["Zod Validators"]
            RateLimiter["Rate Limiter"]
        end

        subgraph DatabaseLayer["データ層"]
            Drizzle["Drizzle ORM"]
        end
    end

    subgraph ExternalServices["外部サービス"]
        VercelSandbox["Vercel Sandbox SDK"]
        GitHubAPI["GitHub API"]
        Gist["GitHub Gist"]
        Redis["Upstash Redis"]
    end

    subgraph DataStorage["データストレージ"]
        PostgreSQL[("PostgreSQL")]
    end

    %% 接続
    Browser --> React
    React --> TanStack
    TanStack --> BackendAPI
    Hooks --> Storage
    
    APISandbox --> SandboxManager
    APISessions --> DBQueries
    APISnapshots --> SandboxManager
    APIConfig --> Validators
    
    SandboxManager --> VercelSandbox
    SandboxManager --> DBQueries
    DBQueries --> Drizzle
    Drizzle --> PostgreSQL
    
    VercelSandbox --> GitHubAPI
    VercelSandbox --> Gist
    RateLimiter --> Redis
```

## データベーススキーマ

```mermaid
erDiagram
    SESSIONS {
        uuid id PK
        text sandbox_id
        text status
        jsonb config
        text runtime
        text pr_url
        text memo
        timestamp created_at
        timestamp updated_at
    }
    
    LOGS {
        uuid id PK
        uuid session_id FK
        timestamp timestamp
        text level
        text message
    }
    
    SNAPSHOTS {
        uuid id PK
        text snapshot_id UK
        uuid session_id FK
        text source_sandbox_id
        text status
        bigint size_bytes
        timestamp created_at
        timestamp expires_at
    }
    
    SESSIONS ||--o{ LOGS : has
    SESSIONS ||--o{ SNAPSHOTS : creates
```

## サンドボックスライフサイクル

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant API as API Route
    participant Manager as SandboxManager
    participant DB as PostgreSQL
    participant Vercel as Vercel Sandbox
    participant GitHub as GitHub/Gist

    Client->>API: POST /api/sandbox/create
    API->>DB: Create Session
    API->>Manager: createSandbox()
    
    alt Snapshot creation
        Manager->>Vercel: Sandbox.create({snapshot})
    else With Git source
        Manager->>GitHub: Clone repository
        Manager->>Vercel: Sandbox.create({git})
    else Empty sandbox
        Manager->>Vercel: Sandbox.create()
    end
    
    Vercel-->>Manager: sandboxId
    Manager->>DB: Update session with sandboxId
    Manager->>DB: Add log (created)
    
    par Command Execution
        Manager->>Vercel: runCommand()
        Vercel->>GitHub: Download Gist script
        Vercel->>Vercel: Execute in microVM
        Vercel-->>Manager: Stream logs
        Manager->>DB: Store logs
    and Status Monitoring
        Client->>API: GET /api/sandbox/{id}/logs
        API->>Manager: streamLogs()
        Manager->>DB: Get logs
        DB-->>Manager: Log entries
        Manager-->>API: SSE stream
        API-->>Client: Real-time logs
    end
    
    Vercel-->>Manager: Command complete
    Manager->>DB: Update status (completed/failed)
    Manager->>Vercel: stop()
    Manager->>DB: Add log (stopped)
```

## コンポーネント構成

```mermaid
flowchart TB
    subgraph Pages["Pages"]
        Home["/ (Home)"]
        SandboxPage["/sandbox"]
        SandboxDetail["/sandbox/[sessionId]"]
        HistoryPage["/history"]
    end

    subgraph Components["Components"]
        subgraph SandboxComponents["Sandbox Components"]
            ConfigForm["ConfigForm"]
            SessionCard["SessionCard"]
            StatusBadge["StatusBadge"]
            LogViewer["LogViewer"]
        end

        subgraph UIComponents["UI Components"]
            Button["Button"]
            Card["Card"]
            Input["Input"]
            Badge["Badge"]
            Tabs["Tabs"]
        end

        subgraph Providers["Providers"]
            QueryProvider["QueryProvider"]
        end
    end

    subgraph Hooks["Custom Hooks"]
        UseSandbox["useSandbox"]
        UseSessionList["useSessionList"]
        UseLogStream["useLogStream"]
        UseCommonConfig["useCommonConfig"]
    end

    SandboxPage --> ConfigForm
    SandboxDetail --> LogViewer
    SandboxDetail --> StatusBadge
    HistoryPage --> SessionCard
    
    ConfigForm --> UseSandbox
    SessionCard --> UseSessionList
    LogViewer --> UseLogStream
    
    ConfigForm --> Input
    SessionCard --> Card
    SessionCard --> Badge
    StatusBadge --> Badge
    LogViewer --> Tabs
```

## API エンドポイント

```mermaid
flowchart LR
    subgraph SandboxAPIs["サンドボックス管理"]
        POST_Create["POST /api/sandbox/create<br/>新規サンドボックス作成"]
        GET_Session["GET /api/sandbox/{id}<br/>セッション詳細取得"]
        GET_Status["GET /api/sandbox/{id}/status<br/>ステータス取得"]
        GET_Logs["GET /api/sandbox/{id}/logs<br/>ログストリーミング"]
        POST_Snapshot["POST /api/sandbox/{id}/snapshot<br/>スナップショット作成"]
        POST_Stop["POST /api/sandbox/{id}/stop<br/>サンドボックス停止"]
    end

    subgraph SessionAPIs["セッション管理"]
        GET_Sessions["GET /api/sessions<br/>セッション一覧"]
    end

    subgraph SnapshotAPIs["スナップショット管理"]
        GET_Snapshots["GET /api/snapshots<br/>スナップショット一覧"]
        GET_Snapshot["GET /api/snapshots/{id}<br/>スナップショット詳細"]
        DELETE_Snapshot["DELETE /api/snapshots/{id}<br/>スナップショット削除"]
    end

    subgraph ConfigAPIs["設定"]
        GET_Config["GET /api/config<br/>共通設定取得"]
    end
```

## 環境変数と認証

```mermaid
flowchart TB
    subgraph EnvVars["環境変数"]
        subgraph Required["必須"]
            DATABASE_URL["DATABASE_URL<br/>PostgreSQL接続文字列"]
        end

        subgraph Auth["認証（いずれか必須）"]
            VERCEL_OIDC["VERCEL_OIDC_TOKEN<br/>Vercel自動認証"]
            VERCEL_ACCESS["VERCEL_ACCESS_TOKEN<br/>アクセストークン認証"]
        end

        subgraph CommonConfig["共通設定（オプション）"]
            COMMON_GITHUB["COMMON_GITHUB_TOKEN<br/>デフォルトGitHubトークン"]
            COMMON_OPENCODE["COMMON_OPENCODE_AUTH_JSON_B64<br/>デフォルトOpenCode認証"]
            COMMON_GIST["COMMON_GIST_URL<br/>デフォルトGist URL"]
        end

        subgraph SandboxConfig["サンドボックス設定（オプション）"]
            SANDBOX_RUNTIME["VERCEL_SANDBOX_RUNTIME<br/>デフォルトランタイム"]
            SANDBOX_TIMEOUT["VERCEL_SANDBOX_TIMEOUT_MS<br/>タイムアウト時間"]
        end
    end

    subgraph Usage["利用方法"]
        LocalDev["ローカル開発:<br/>vercel env pull"]
        Production["本番環境:<br/>自動設定"]
    end

    DATABASE_URL --> LocalDev
    DATABASE_URL --> Production
    VERCEL_OIDC --> Production
    VERCEL_ACCESS --> LocalDev
    CommonConfig --> LocalDev
    CommonConfig --> Production
```

## 技術スタック

| レイヤー | 技術 | 用途 |
|---------|------|------|
| フレームワーク | Next.js 16 | App Router, API Routes |
| 言語 | TypeScript 5 | 型安全性 |
| フロントエンド | React 19 | UIフレームワーク |
| UIライブラリ | shadcn/ui + Tailwind CSS 4 | コンポーネント, スタイリング |
| 状態管理 | TanStack Query | サーバーステート管理 |
| データベース | PostgreSQL | データ永続化 |
| ORM | Drizzle ORM | データベース操作 |
| サンドボックス | @vercel/sandbox | Linux microVM管理 |
| 認証 | Vercel OIDC Token | セキュア認証 |
| バリデーション | Zod | データ検証 |
| レート制限 | Upstash Redis | API保護 |
