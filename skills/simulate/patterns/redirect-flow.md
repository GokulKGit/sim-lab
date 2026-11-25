# Pattern: redirect flow (several parties take turns)

**Use for:** OAuth 2.0 (authorization code + PKCE), OpenID Connect login, SAML SSO, "Sign in with…", 3-D Secure payment redirects, email magic links. The browser is bounced between parties, and secrets move through the **front channel** (the browser) or the **back channel** (server to server).

## Diagram (820×430)
| id | kind | x, y | note |
|---|---|---|---|
| `user` | actor | 90, 215 | the person in the browser |
| `app` | svc | 330, 100 | the client app that wants access |
| `auth` | svc | 330, 330 | the authorization server or identity provider |
| `api` | svc | 640, 215 | the resource server/API (optional) |
| `attacker` | actor | 640, 380 | only in failure steps; add with `L.spec(..., {nodes: [...]})` |

- Use link `label`s for channels: `'front: redirect'` and `'back: POST /token'`.
- Show tokens as speech bubbles (`say`), not as nodes.

## Tour outline (7–10 steps)
1. **The goal:** the app wants to act for the user without ever seeing their password.
2. **Redirect to /authorize:** `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`. Show this as a flow with the browser in the middle: `['app','user','req','302 → /authorize']`, then `['user','auth']`.
3. **Login and consent at the auth server:** the password goes only to `auth`. Use `{ flash: 'auth' }`.
4. **Redirect back with a code:** `?code=…&state=…`. The app checks that `state` matches what it sent.
5. **Back-channel token exchange:** the app sends `code` + `code_verifier` to the token endpoint and gets an access token (and ID and refresh tokens).
6. **Calling the API:** `Authorization: Bearer …`. The API validates the token.
7. **Expiry and refresh:** a 401, then a refresh token gets a new access token.
8. **Failures and common mistakes:**
   - a stolen code is useless without the PKCE verifier;
   - a missing `state` check allows CSRF;
   - `redirect_uri` must match exactly;
   - tokens kept in the wrong place.

## Simulator model (full size): a step machine, not a time loop
```js
init: () => ({ step: 0, pkce: true, stateCheck: true, tokenTtl: 60, attacker: false, tokens: null, log: [], clock: 0 })
// steps: ['start','at-authorize','logged-in','code-returned','token-exchanged','api-called']
// actions advance one step at a time; tick only ages the tokens (clock += dt; access token expires at tokenTtl)
// attacker toggle: during 'code-returned' the attacker copies the code; the exchange succeeds only if !pkce
```
- **Controls:** PKCE on/off, state check on/off, access-token lifetime (10–300 s), attacker present on/off. Actions: "Next step", "Call API", "Wait for expiry", "Replay stolen code".
- **Scenarios:**
  - **Happy path.**
  - **Code intercepted, PKCE off → account taken over.**
  - **Code intercepted, PKCE on → rejected.**
  - **Token expires → refresh.**
- **Metrics:** current step, the token held (none/access/refresh), seconds to expiry, last API status.
- `explain(s)`: one sentence on what just happened and who now holds which secret.

## Quiz angles
- Why does the token exchange happen server to server and not in the browser URL?
- What does PKCE protect against?
- What does `state` protect against?
- Which token proves identity (ID token) vs grants access (access token)?
- An API returns 401 after an hour. What should the app do?

## Check in sources (don't guess)
- The parameter names (RFC 6749, RFC 7636 PKCE, OpenID Connect Core).
- Which flows are discouraged (implicit, password grant: see the OAuth 2.0 Security BCP, RFC 9700).
- Typical token lifetimes, and say that they vary by provider.
