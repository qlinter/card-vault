# Local TLS fixture

The certificate and private key in this directory are generated test material for loopback HTTP/HTTPS proxy tests. They do not belong to a real service or account.

Tests trust this certificate only in an isolated child process through `NODE_EXTRA_CA_CERTS`. Production TLS validation remains enabled. The fixture covers `localhost` and `127.0.0.1`; it is not included in application distribution files.
