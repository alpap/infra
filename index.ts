import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'

// create VPC
const main = new awsx.ec2.Vpc('main', {
  numberOfAvailabilityZones: 1,
  tags: {
    Name: 'main',
  },
})

// Add an s3 endpoint
new aws.ec2.VpcEndpoint('s3-vpc-endpoint', {
  vpcId: main.vpc.id,
  vpcEndpointType: 'Gateway',
  serviceName: 'com.amazonaws.eu-north-1.s3',
  routeTableIds: main.routeTables.apply((e) => e.map((e) => e.id)),
  policy: pulumi
    .output({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:*',
          Resource: '*',
        },
      ],
    })
    .apply(JSON.stringify),
})

// Create buckets
const artifact_bucket = new aws.s3.Bucket('nexus', {
  bucket: 'nexus-akfjhie33',
  acl: 'private',
}) //, undefined, { protect: true }) // if the bucket is protected you have to remove this part apply (pulumi up) then delete (pulumi down)
// give access to buckt from internal network
const nexus_bucket_access = new aws.s3.AccessPoint('nexus-access-point', {
  accountId: pulumi.output(aws.getCallerIdentity()).accountId,
  bucket: artifact_bucket.bucket,
  name: 'nexus-access-point',
  publicAccessBlockConfiguration: {
    blockPublicAcls: true,
    ignorePublicAcls: true,
    blockPublicPolicy: true,
    restrictPublicBuckets: true,
  },
})

const vault_bucket = new aws.s3.Bucket('vault', {
  bucket: 'vault-akfjhie33',
  acl: 'private',
})

// give access to buckt from internal network
const vault_bucket_access = new aws.s3.AccessPoint('vault-access-point', {
  accountId: pulumi.output(aws.getCallerIdentity()).accountId,
  bucket: vault_bucket.bucket,
  name: 'vault-access-point',
  publicAccessBlockConfiguration: {
    blockPublicAcls: true,
    ignorePublicAcls: true,
    blockPublicPolicy: true,
    restrictPublicBuckets: true,
  },
})

// Create an ecr repository for storing docker images
const repo = new awsx.ecr.Repository('skytem', {
  forceDelete: true,
})

// Build and publish our application's container image from ./app to the ECR repository.
const image = new awsx.ecr.Image('vault', {
  imageName: 'vault',
  repositoryUrl: repo.url,
  context: './vault_docker',
  platform: 'linux/amd64',
})

const nexus_image = new awsx.ecr.Image('nexus', {
  imageName: 'nexus',
  repositoryUrl: repo.url,
  context: './nexus_docker',
  platform: 'linux/amd64',
})

// Create ecs cluster
const cluster = new aws.ecs.Cluster('cluster', {})

// Create vault security group
const vault_securityGroup = new aws.ec2.SecurityGroup('vault', {
  vpcId: main.vpc.id,
  ingress: [
    {
      fromPort: 8200,
      toPort: 8200,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
  ],
  egress: [
    {
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
  ],
})

const s3role = new aws.iam.Role('vault_role', {
  name: 'vault_role',
  inlinePolicies: [
    {
      policy: vault_bucket.arn.apply((arn) =>
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                's3:ListBucket',
                's3:GetBucketLocation',
                's3:GetObject',
                's3:GetObjectAcl',
                's3:PutObject',
                's3:PutObjectAcl',
                's3:DeleteObject',
                's3:DeleteObjects',
                'kms:Encrypt',
                'kms:Decrypt',
                'kms:GenerateDataKey',
                'kms:ListKeys',
                'kms:DescribeKey',
              ],
              Resource: [arn, `${arn}/*`],
            },
          ],
        }),
      ),
    },
  ],
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: 'ecs-tasks.amazonaws.com' }),
})

const vault = new awsx.ecs.FargateService('vault', {
  cluster: cluster.arn,
  forceNewDeployment: true,
  desiredCount: 1,
  networkConfiguration: {
    subnets: main.privateSubnetIds,
    securityGroups: [vault_securityGroup.id],
  },
  taskDefinitionArgs: {
    taskRole: {
      roleArn: s3role.arn,
    },
    family: 'vault-fargate',
    memory: '2048',
    cpu: '1024',
    runtimePlatform: {
      operatingSystemFamily: 'LINUX',
      cpuArchitecture: 'X86_64',
    },
    container: {
      name: 'vault',
      image: image.imageUri,
      cpu: 1024,
      memory: 2048,
      essential: true,
      portMappings: [
        {
          hostPort: 8200,
          protocol: 'tcp',
        },
      ],
      environment: [
        {
          name: 'AWS_ACCESS_KEY_ID',
          value: process.env.AWS_ID,
        },
        {
          name: 'AWS_DEFAULT_REGION',
          value: process.env.AWS_REGION,
        },
        {
          name: 'AWS_S3_BUCKET',
          value: 'vault-akfjhie33',
        },
        {
          name: 'AWS_SECRET_ACCESS_KEY',
          value: process.env.AWS_SECRET,
        },
        {
          name: 'VAULT_AWSKMS_SEAL_KEY_ID',
          value: '${AWS_KMS_SEAL_KEY_ID}',
        },
      ],
    },
  },
})

const twingate_securityGroup = new aws.ec2.SecurityGroup('twingate', {
  vpcId: main.vpc.id,
  ingress: [
    {
      fromPort: 80,
      toPort: 80,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
  ],
  egress: [
    {
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
  ],
})

const twingate = new awsx.ecs.FargateService('twingate', {
  cluster: cluster.arn,
  forceNewDeployment: true,
  desiredCount: 1,
  networkConfiguration: {
    subnets: main.privateSubnetIds,
    securityGroups: [twingate_securityGroup.id],
  },
  taskDefinitionArgs: {
    family: 'twingate-fargate',
    memory: '2048',
    cpu: '1024',
    container: {
      name: 'twingate-aws',
      image: 'twingate/connector:1.70.0',
      memory: 2048,
      cpu: 1024,
      environment: [
        {
          name: 'TWINGATE_NETWORK',
          value: 'cloudnation',
        },
        {
          name: 'TWINGATE_ACCESS_TOKEN',
          value: process.env.TWINGATE_ACCESS_TOKEN,
        },
        {
          name: 'TWINGATE_REFRESH_TOKEN',
          value: process.env.TWINGATE_REFRESH_TOKEN,
        },
        {
          name: 'TWINGATE_LABEL_DEPLOYED_BY',
          value: 'ecs',
        },
      ],
    },
  },
})

// Create an EFS file system to attach to nexus
const efsFileSystem = new aws.efs.FileSystem('nexus-file-system', {
  performanceMode: 'generalPurpose',
  encrypted: true,
  tags: {
    Name: 'nexus-file-system',
  },
})

// Attach to all subnets
main.privateSubnetIds.apply((ids) =>
  ids.map((id) => {
    new aws.efs.MountTarget('nexus-mount', {
      fileSystemId: efsFileSystem.id,
      subnetId: id,
      securityGroups: [nexus_securityGroup.id],
    })
  }),
)

const backupVault = new aws.backup.Vault('nexus-backup-vault', {
  name: 'nexus-backup-vault',
})

// Create a Backup Plan with a daily backup rule
const backupPlan = new aws.backup.Plan('nexus-backup-plan', {
  name: 'nexus-backup-plan',
  rules: [
    {
      ruleName: 'dailyBackup',
      targetVaultName: backupVault.name,
      schedule: 'cron(0 5 * * ? *)', // Daily at 5 AM UTC
      lifecycle: {
        deleteAfter: 7, // Retain backups for 7 days
      },
    },
  ],
})

const backupServiceRole = new aws.iam.Role('AWSBackupDefaultServiceRole', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'sts:AssumeRole',
        Principal: {
          Service: 'backup.amazonaws.com',
        },
        Effect: 'Allow',
        Sid: '',
      },
    ],
  }),
  tags: {
    Name: 'AWSBackupDefaultServiceRole',
  },
})

// Attach the AWSBackupServiceRolePolicyForBackup managed policy to the role
const backupServiceRolePolicyAttachment = new aws.iam.RolePolicyAttachment('AWSBackupServiceRolePolicyAttachment', {
  role: backupServiceRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup',
})

// Assign the EFS file system to the backup plan
const backupSelection = new aws.backup.Selection('nexus-daily-backup-selection', {
  planId: backupPlan.id,
  name: 'nexus-daily-backup-selection',
  resources: [efsFileSystem.arn],
  iamRoleArn: backupServiceRole.arn,
})

const nexus_securityGroup = new aws.ec2.SecurityGroup('nexus', {
  vpcId: main.vpc.id,
  ingress: [
    {
      fromPort: 22,
      toPort: 22,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
    {
      fromPort: 2049,
      toPort: 2049,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
    {
      fromPort: 8081,
      toPort: 8081,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
    {
      fromPort: 8082,
      toPort: 8082,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
    {
      fromPort: 8083,
      toPort: 8083,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
    {
      fromPort: 8085,
      toPort: 8085,
      protocol: 'tcp',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
  ],
  egress: [
    {
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: ['0.0.0.0/0'],
      ipv6CidrBlocks: ['::/0'],
    },
  ],
})

const nexus = new awsx.ecs.FargateService('nexus_service', {
  cluster: cluster.arn,
  forceNewDeployment: true,
  desiredCount: 1,
  networkConfiguration: {
    subnets: main.privateSubnetIds,
    securityGroups: [nexus_securityGroup.id],
  },

  taskDefinitionArgs: {
    family: 'nexus-fargate',
    memory: '16384',
    cpu: '4096',
    runtimePlatform: {
      operatingSystemFamily: 'LINUX',
      cpuArchitecture: 'X86_64',
    },
    taskRole: {
      roleArn: s3role.arn,
    },
    container: {
      name: 'nexus',
      image: nexus_image.imageUri,
      cpu: 4096,
      memory: 16384,
      essential: true,
      mountPoints: [
        {
          containerPath: '/nexus-data',
          sourceVolume: 'nexus-volume',
        },
      ],
      portMappings: [
        {
          containerPort: 8081,
        },
        {
          containerPort: 8082,
        },
        {
          containerPort: 8083,
        },
        {
          containerPort: 8085,
        },
      ],
    },
    volumes: [
      {
        name: 'nexus-volume',
        efsVolumeConfiguration: {
          fileSystemId: efsFileSystem.id,
        },
      },
    ],
  },
})
