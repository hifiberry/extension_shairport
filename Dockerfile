# Stage 1: Builder 
FROM alpine:latest AS builder

# Install required build dependencies
RUN apk add --no-cache \
    build-base \
    autoconf \
    automake \
    libtool \
    libdaemon-dev \
    popt-dev \
    libconfig-dev \
    avahi-dev \
    dbus-dev \
    alsa-lib-dev \
    openssl-dev \
    glib-dev \
    git \
    libplist-dev \
    libsodium-dev \
    libgcrypt-dev 

RUN apk add ffmpeg-dev  vim

# Clone shairport-sync repository
RUN git clone https://github.com/mikebrady/shairport-sync.git /shairport-sync

# Set working directory
WORKDIR /shairport-sync

# Configure and build shairport-sync
RUN autoreconf -i -f && \
    ./configure --sysconfdir=/etc \
                --with-metadata \
                --with-stdout \
                --with-alsa \
                --with-stdout \
                --with-avahi \
                --with-ssl=openssl \
                --with-airplay-2 \
                --with-mpris-interface && \
    make


# Clone Nqptp repository
WORKDIR /
RUN git clone https://github.com/mikebrady/nqptp.git /nqptp

# Set working directory
WORKDIR /nqptp

# Configure and build Nqptp
RUN autoreconf -i -f && \
    ./configure && \
    make

# Stage 2: Create smaller production container
FROM alpine:latest

# Stage 2: Create smaller production container
FROM alpine:latest

RUN apk add --no-cache \
    libconfig \
    avahi-libs \
    dbus \
    alsa-lib \
    openssl \
    glib \
    popt \
    curl \
    libplist \
    libsodium \
    libgcrypt \
    ffmpeg \
    util-linux \
    libcap

RUN addgroup -S shairport && adduser -S -G shairport -u 2002 shairport

# Copy the compiled binary from the builder stage
COPY --from=builder /shairport-sync/shairport-sync /usr/local/bin/shairport-sync
COPY --from=builder /nqptp/nqptp /usr/local/bin/nqptp
RUN setcap 'cap_net_bind_service=+ep' /usr/local/bin/nqptp
COPY docker/run.sh /run.sh
COPY docker/pause-others.sh /pause-others.sh

RUN apk add --no-cache libcap

# Clean up unnecessary files
RUN rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Expose the port used by shairport-sync
EXPOSE 5000

# Expose the port used by Nqptp
EXPOSE 123

# Set the entry point to start shairport-sync
ENTRYPOINT ["/run.sh"]

USER shairport

