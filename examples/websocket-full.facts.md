# WebSocket facts
Sources: [1] RFC 6455 rfc-editor.org/rfc/rfc6455 · [2] MDN WebSocket API · [3] nginx "WebSocket proxying"
## Actors
browser/client (new WebSocket(url)) [2] · reverse proxy / LB (e.g. nginx) [3] · server [1]
## Steps
1. Client sends HTTP/1.1 GET with Upgrade: websocket, Connection: Upgrade, Sec-WebSocket-Key (base64 16-byte random nonce), Sec-WebSocket-Version: 13 [1 §4.1]
2. Server replies HTTP/1.1 101 Switching Protocols + Upgrade/Connection + Sec-WebSocket-Accept = base64(SHA-1(key + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11)) [1 §4.2.2]. Any status other than 101 = handshake not done [1 §1.3]
3. Frames both ways over the same TCP connection. Opcodes: 0x0 continuation, 0x1 text, 0x2 binary, 0x8 close, 0x9 ping, 0xA pong [1 §5.2]
4. Client MUST mask every frame; server MUST NOT. Server that gets an unmasked frame MUST close (MAY use 1002) [1 §5.1]. Reason: stop scripts crafting bytes that proxies misread as HTTP (cache poisoning) [1 §10.3]
5. Ping → peer MUST answer Pong with identical payload; unsolicited Pong allowed [1 §5.5.2-3]. Control frames ≤125 bytes payload, not fragmented [1 §5.5]
6. Close: either side sends Close (2-byte code + optional reason), other side echoes Close, then TCP closes; server closes TCP first [1 §1.4, 5.5.1]
## Defaults / limits
- Payload length: 7-bit (0–125), 126 → 16-bit, 127 → 64-bit [1 §5.2]
- nginx closes a proxied WebSocket if the backend sends nothing for 60 s by default (proxy_read_timeout); fix: raise it or have server send pings [3]
- nginx must pass Upgrade + Connection headers explicitly (hop-by-hop) [3]
- Close codes: 1000 normal, 1001 going away, 1002 protocol error, 1003 unsupported data, 1008 policy, 1009 too big, 1011 internal error; 1006 = closed with no Close frame, never sent on the wire [1 §7.4.1, 7.1.5]
- Reconnect after abnormal close: SHOULD back off; first delay random, 0–5 s suggested; later truncated binary exponential backoff [1 §7.2.3]
- Browser API: readyState CONNECTING/OPEN/CLOSING/CLOSED; events open/message/error/close; send(), close(); bufferedAmount = bytes queued not yet sent [2]
- Browser API has no backpressure; WebSocketStream adds it [2]
## Common failures
- Proxy idle timeout (nginx 60 s) kills a quiet connection [3]
- Proxy not forwarding Upgrade/Connection → no 101, handshake fails [3][1 §1.3]
- Cable pulled: no Close frame, code 1006; noticed only via missed ping or failed write [1 §7.1.5]
- Instant reconnect of every client after a restart (no random delay/backoff) [1 §7.2.3]
- Unmasked client frame → server closes, 1002 [1 §5.1]
