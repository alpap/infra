#

## Twingate

### AWS web console

Get the ip address of the ECS task buy going to
Amazon Elastic Container Service > Clusters > cluster-name > Services > vault-name > Tasks > task id

select networking and copy the private address

### Twingate

- Go to your network
- Click create resource
- Name it Vault
- Add the ip address
- Add an alias for easy access

navigate to `http://vault.int:8200/`

Repeat the process for Nexus

#### Automatically update IPs

In the script `.\scripts\update_ips_in_twingate.sh`
Update the variable name `REMOTE_NETWORK_NAME` and then execute it

```bash
.\scripts\update_ips_in_twingate.sh
```

## Making certificates

To generate the certificates use the command bellow
It will generate certificates for `nexus.int` and `nexus.int`
The are valud for a year

```bash
generate_certs.sh
pulumi up
```

In the docker file for vaut add

```docker
COPY /certs /certs
```

In the vault config add

```hcl
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/certs/vault.int+1.pem"
  tls_key_file  = "/certs/vault.int+1-key.pem"
}
```

if you want to import the certificate check the steps [here](https://www.pico.net/kb/how-do-you-get-chrome-to-accept-a-self-signed-certificate/)

## Setting up OIDC in Vault

More info [here](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-hashicorp-vault)

```bash
vault auth enable jwt


vault write auth/jwt/config \
  bound_issuer="https://token.actions.githubusercontent.com" \
  oidc_discovery_url="https://token.actions.githubusercontent.com"

vault

vault secrets enable -path=ci kv

vault kv put ci/nexus nexus_username=nexus_user nexus_password=nexus_pass

vault policy write ci - <<EOF
# Read-only permission on 'ci/data/nexus/*' path

path "ci/data/nexus/*" {
  capabilities = [ "read" ]
}
EOF


vault write auth/jwt/role/ci -<<EOF
{
  "role_type": "jwt",
  "user_claim": "sub",
  bound_claims_type: glob,
  "bound_claims": {
    "repository": "user-or-org-name"
  },
  "policies": ["ci"],
  "ttl": "60m"
}


```

From here use the `github_actions_template` to make your github actions

## Setting up Nexus

### Set up s3 storage

#### Aws console

- IAM > Users > service-user
- Click on security credentials
- Under `Access Keys` click `Create access key`
- Select any option

- Click
  `I understand the above recommendation and want to proceed to create an access key.`
- Enter a description tag
- Copy the keys

#### Nexus

- Login ussing the username `admin` and password `admin123`
- Navigate to Settings > Blob Stores
- Clock create Blob Store
- AS type select `S3`
- Give it a name
- Select `eu-north-1` as region
- Enter the backet's name ex nexus-123456
- Click Authentication
- Enter the keys from the AWS console
- Click save
