default_max_request_duration = "90s"
disable_clustering           = true
disable_mlock                = true
ui                           = true

#listener "tcp" {
#  address     = "0.0.0.0:8200"
#  tls_disable = "true"
#}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/certs/vault.int+1.pem"
  tls_key_file  = "/certs/vault.int+1-key.pem"
}

disable_mlock = true
api_addr = "http://0.0.0.0:8200"


# https://www.vaultproject.io/docs/configuration/seal/awskms
#seal "awskms" {}



# https://www.vaultproject.io/docs/configuration/storage/s3
storage "s3" {}
