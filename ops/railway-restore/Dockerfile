FROM postgres:18-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli gzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /restore
COPY restore.sh /restore/restore.sh
RUN chmod +x /restore/restore.sh

CMD ["/restore/restore.sh"]