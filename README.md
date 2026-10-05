# @crowsi/provider-http-transport

## 日本語

許可したHTTPS originに対して、request/responseのbyte上限とtimeout付きでHTTP通信を行います。
製品API、認証方式、アカウント、データ保存は含みません。公開は準備中で、以下は`0.10.0`のregistry配布確認後に使う例です。

```sh
npm install --save-exact @crowsi/provider-http-transport@0.10.0
```

```js
import { createProviderHttpTransport } from '@crowsi/provider-http-transport'
const transport = createProviderHttpTransport({
  allowedOrigins: ['https://provider.example'],
  maximumRequestBytes: 65536,
  maximumResponseBytes: 1048576,
  timeoutMs: 15000
})
// 実際の接続先・認証情報は利用appの所有者が設定します。
const result = await transport.request({ url: 'https://provider.example/items' })
```

originはpath・末尾slash・userinfoを含まないcanonical HTTPS originを指定します。
HTTP、別origin/port、URL内認証情報、fragment、redirectを拒否します。許可methodはGET/POST/PATCH/PUT/DELETEです。
GET/DELETEのbodyを拒否し、string・URLSearchParams・ArrayBuffer/view・Blobを実byte数で検査します。
FormData/stream等の事前に数えられないbodyは、型がBodyInitでもruntimeで拒否します。
byte上限は1〜16MiB、timeoutは1〜60000ms。既定上限はrequest64KiB/response1MiBです。

responseはstatus/statusText/Headers/Uint8Array bodyを返します。HTTPエラーstatusの解釈はapp側で行います。
停止したbody読み取りもabort/timeoutで終了し、cancelの後始末を待って停止し続けません。
caller cancellationは`transport/request/aborted`、内部timerは`transport/request/timeout`、通信失敗は`transport/request/unavailable`です。
origin/サイズ/method/redirectのエラーも`ProviderTransportError.code`で判定できます。

headersはcallerが明示した値をfetchへ渡し、request情報を結果に追加しません。認証headerの生成・保存・ログ出力は行いません。
browser fetchの既定credentials/CORS/cookie動作は変更しません。同一originではbrowserの既定によりcookieが送られることがあります。
`cause`は診断用の元エラーを保持するため、URL/認証情報を含み得る詳細をログに出さずcodeだけで扱ってください。
`fetchImplementation`は信頼された差替え用です。signal/manual redirectに従わない実装の外部通信を強制停止するsandboxではありません。
timeoutは非同期I/O待ちを制限し、event loop停止やbrowser休止中の実時間保証は行いません。

## English

Use a bounded HTTP transport with an explicit HTTPS-origin policy. The package contains no product API, authentication scheme, account storage or persistence.
Registry publication of `0.10.0` is pending. After confirming it, install the exact version above and configure the transport with the application's reviewed destination and authentication policy.

Only canonical HTTPS origins and GET/POST/PATCH/PUT/DELETE are admitted. Reject URL credentials, fragments, other origins/ports and redirects.
Request bodies must be measurable: strings, URLSearchParams, ArrayBuffer/views or Blob. FormData and streams are rejected at runtime even though the retained declaration uses BodyInit.
Bounds are 1–16MiB and 1–60000ms; defaults are 64KiB requests, 1MiB responses and 15000ms.
Responses return status, statusText, Headers and Uint8Array bytes; applications interpret HTTP error statuses.

Stalled fetch/body waits settle on abort/timeout. Caller cancellation remains distinct from the internal timer, and best-effort stream cleanup does not block the result.
Caller headers are forwarded; no request credential logging or storage is performed. Browser credentials/CORS/cookie defaults remain unchanged, including possible same-origin cookies.
Error causes retain driver details: log safe codes rather than potentially sensitive causes. A custom fetch implementation is trusted and remains responsible for honoring signal and manual redirects.
This bounds asynchronous waiting rather than providing a real-time guarantee during event-loop suspension.

## Development / 開発

Runtime: Node.js22+. Release checks use Node.js24.15.0 and npm11.12.1.

```sh
npm ci
npm run check
npm test
npm pack
```

`src/*.mts` is the typed implementation. `dist/*.mjs` and declarations are generated together by `npm run build`; do not edit or commit them.
`npm run check` verifies Biome format/lint, strict implementation and consumer types, and the user 120 physical-line limit. The internal rule is 149 non-empty/non-comment lines; this candidate enforces the stricter requested physical limit.
`prepack` runs these checks, builds, and runs runtime tests. Verify the exact archive in a fresh consumer before publication.
Synthetic fetch/stream cases and a loopback-only adapter cover failure paths; the adapter does not establish real TLS, browser cookie/CORS or customer-service compatibility.
No real provider credentials or external mail APIs are used in tests.

[Usage guide](https://github.com/crowsi-net/crowsi-provider-http-transport/blob/main/docs/getting-started.md) · [Security reporting](SECURITY.md) · [Apache-2.0 license](LICENSE) · [Attribution](NOTICE)
