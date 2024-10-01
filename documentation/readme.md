# Get credentials

## Get acess keys

- Click on your username top right of the of the screen
- Click **Secure Credentials**
- Click **Create access key**
- Copy the values to env values

```bash
export AWS_ACCESS_KEY_ID="<YOUR_ACCESS_KEY_ID>"
export AWS_SECRET_ACCESS_KEY="<YOUR_SECRET_ACCESS_KEY>"
export AWS_PROFILE="default"
```

## Deploy

```bash
pulumi up
```

## After deployment

Get the bucket name and add the config to ./vault_docker/config.hcl

Then redeploy for vault to get the configuration

## Moving to another cloud

- Create a new infrastructure with pulumi
- Download the resources from s3
- Deploy new infrastructure
- upload the data
