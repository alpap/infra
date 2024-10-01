FROM debian:buster as builder

ENV VAULT_VERSION=1.17.6

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y wget unzip
RUN wget -q https://releases.hashicorp.com/vault/${VAULT_VERSION}/vault_${VAULT_VERSION}_linux_amd64.zip
RUN unzip vault_${VAULT_VERSION}_linux_amd64.zip

FROM alpine:latest as certs
RUN apk --update add ca-certificates
RUN ls

FROM scratch
COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /vault .
COPY vault-config.hcl /etc/vault/vault-config.hcl


ENTRYPOINT ["/vault", "server", "-config", "/etc/vault/vault-config.hcl"]