#!/usr/bin/env bash

# Make self signed certtificates

if [ ! -d "./certs" ]; then
  mkdir ./certs
fi

cd ./certs || exit 1

if [[ ! $(which mkcert) ]]; then
  openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/C=XX/ST=StateName/L=CityName/O=CompanyName/OU=CompanySectionName/CN=CommonNameOrHostname"
fi

mkcert -install
mkcert -CAROOT

#Generate certificates
mkcert vault.int nexus.int

cd ..
cp ./certs vault_docker
cp ./certs nexus_docker
