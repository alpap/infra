FROM alpine

ARG NEXUS_VERSION=3.72.0-04
ARG NEXUS_DOWNLOAD_URL=https://download.sonatype.com/nexus/3/nexus-${NEXUS_VERSION}-unix.tar.gz
ARG NEXUS_DOWNLOAD_SHA256_HASH=45148c0645ab0611f6881b782b83e9dab0dbfb1b848e9b95ebaeb274c708a1c0

# configure nexus runtime
ENV SONATYPE_DIR=/opt/sonatype
ENV NEXUS_HOME=${SONATYPE_DIR}/nexus \
  NEXUS_DATA=/nexus-data \
  NEXUS_CONTEXT='' \
  SONATYPE_WORK=${SONATYPE_DIR}/sonatype-work \
  DOCKER_TYPE='alpine'

# Install Java & tar
RUN apk add openjdk17 tar procps gzip curl shadow \
  && apk cache clean

RUN apk del --no-cache openssl || true
RUN apk update && apk add --no-cache openssl

WORKDIR ${SONATYPE_DIR}

# Download nexus & setup directories
RUN curl -L ${NEXUS_DOWNLOAD_URL} --output nexus-${NEXUS_VERSION}-${JAVA_VERSION}-unix.tar.gz \
  && echo "${NEXUS_DOWNLOAD_SHA256_HASH} nexus-${NEXUS_VERSION}-${JAVA_VERSION}-unix.tar.gz" > nexus-${NEXUS_VERSION}-${JAVA_VERSION}-unix.tar.gz.sha256 \
  && sha256sum -c nexus-${NEXUS_VERSION}-${JAVA_VERSION}-unix.tar.gz.sha256 \
  && tar xvf nexus-${NEXUS_VERSION}-${JAVA_VERSION}-unix.tar.gz \
  && rm -f nexus-${NEXUS_VERSION}-${JAVA_VERSION}-unix.tar.gz nexus-${NEXUS_VERSION}-${JAVA_VERSION}-unix.tar.gz.sha256 \
  && mv nexus-${NEXUS_VERSION} $NEXUS_HOME \
  && mv ${SONATYPE_WORK}/nexus3 ${NEXUS_DATA} \
  && ln -s ${NEXUS_DATA} ${SONATYPE_WORK}/nexus3

# Removing java memory settings from nexus.vmoptions since now we use INSTALL4J_ADD_VM_PARAMS
RUN sed -i '/^-Xms/d;/^-Xmx/d;/^-XX:MaxDirectMemorySize/d' $NEXUS_HOME/bin/nexus.vmoptions

RUN echo "#!/bin/bash" >> ${SONATYPE_DIR}/start-nexus-repository-manager.sh \
  && echo "cd /opt/sonatype/nexus" >> ${SONATYPE_DIR}/start-nexus-repository-manager.sh \
  && echo "exec ./bin/nexus run" >> ${SONATYPE_DIR}/start-nexus-repository-manager.sh \
  && chmod a+x ${SONATYPE_DIR}/start-nexus-repository-manager.sh \
  && sed -e '/^nexus-context/ s:$:${NEXUS_CONTEXT}:' -i ${NEXUS_HOME}/etc/nexus-default.properties

RUN apk del gzip shadow

VOLUME ${NEXUS_DATA}

EXPOSE 8081

ENV INSTALL4J_ADD_VM_PARAMS="-Xms2703m -Xmx2703m -XX:MaxDirectMemorySize=2703m -Djava.util.prefs.userRoot=${NEXUS_DATA}/javaprefs"

CMD ["/opt/sonatype/nexus/bin/nexus", "run"]