# Changelog

All notable changes to this project are documented here.

---

## v0.1.2 - 2026-07-10

### Fixes

- Google TV pairing and remote connections are now pinned to IPv4, fixing intermittent `EHOSTUNREACH` failures where a resolved hostname could yield a scopeless IPv6 link-local address that routed to loopback instead of the device. ([030f16d](https://github.com/kud/androidtv-remote/commit/030f16d5cafba269d2a33700f64af1b3e26097b5))
- Pairing now retries transient connect failures (`EHOSTUNREACH`, `EHOSTDOWN`, `ETIMEDOUT`, `ECONNREFUSED`, `ECONNRESET`) a few times before giving up, so a TV dozing in Wi-Fi power-save mode gets a chance to wake up instead of failing the pairing attempt outright. ([030f16d](https://github.com/kud/androidtv-remote/commit/030f16d5cafba269d2a33700f64af1b3e26097b5))
- Fixed the npm publish workflow's OIDC trusted-publisher pattern so releases publish correctly. ([749c968](https://github.com/kud/androidtv-remote/commit/749c9687bdec732cbd1caea833b2d4e412bcf89b))

### Documentation

- Rewrote the docs index as proper orientation content instead of a README copy, and added the kud.io docs landing page. ([ba79679](https://github.com/kud/androidtv-remote/commit/ba79679e8b70c2cd5b6b6cf57bf208b0d6c49bf2))
