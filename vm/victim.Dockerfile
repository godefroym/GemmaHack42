# Disposable "victim" host for the Gemma IR lab. It runs real systemd so the
# scenario's service persistence and Service Stop steps are genuine, not faked.
# Works identically on Docker Desktop for macOS and Windows.
FROM ubuntu:24.04

ENV container=docker
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        systemd systemd-sysv jq zstd iproute2 procps findutils util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /etc/gemma-ir-lab \
    && touch /etc/gemma-ir-lab/authorized

# Lab scenario and collector scripts.
COPY vm/ /opt/gemma-ir/vm/

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
