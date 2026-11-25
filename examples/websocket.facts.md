# WebSocket: facts (quick size)

Sources: [1] RFC 6455 · [2] nginx WebSocket proxying · [3] MDN WebSocket API

## Actors
- The browser (client), an optional proxy or load balancer, and the server [1][2]

## Steps, with real names
1. Plain HTTP is request → response, so a server can't speak first. WebSocket gives two-way communication over one connection [1 §1.1]
2. Opening handshake: `GET /chat HTTP/1.1` with `Upgrade: websocket`, `Connection: Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version: 13` [1 §1.3]
3. Server reply: `HTTP/1.1 101 Switching Protocols` + `Sec-WebSocket-Accept` = base64(SHA-1(key + GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)) [1 §4.2.2]
4. After that, data goes as frames. Opcodes: 0x1 text, 0x2 binary, 0x8 close, 0x9 ping, 0xA pong [1 §5.2]
5. Client-to-server frames are masked; server-to-client frames are not [1 §5.1]
6. Ping → Pong "as soon as is practical" [1 §5.5.2]
7. Closing handshake: each side sends a Close frame. 1000 = normal, 1001 = going away [1 §7.1.2, §7.4.1]
8. 1006 is never sent in a frame. It means the connection closed without a Close frame [1 §7.4.1]
9. Reconnecting: wait a random delay first, then back off, so clients don't all reconnect at once [1 §7.2.3]

## Defaults and limits
- `ws://` uses port 80; `wss://` (over TLS) uses port 443 [1 §3, §1.7]
- nginx closes a proxied connection if the server sends no data for 60 s; `proxy_read_timeout` changes this; server Pings reset it [2]
- `Upgrade` and `Connection` are hop-by-hop headers, so the proxy must forward them explicitly [2]

## Common mistakes
- A proxy's idle timeout silently kills quiet connections, and the browser sees 1006 [1][2]
- A proxy that doesn't forward `Upgrade` means no `101` [2]
- Not checking `Origin` lets scripts on other sites use the server ("cross-origin use") [1 §1.3]
- The browser API has no backpressure, so a fast sender can fill memory [3]
- Everyone reconnecting instantly after a server restart [1 §7.2.3]

Not used (not confirmed on the fetched pages): readyState numbers; whether JavaScript can send Ping.
