import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'
import { log } from 'console'

// create VPC with private and public subnets
const main = new awsx.ec2.Vpc('main', {
  numberOfAvailabilityZones: 1,
  tags: {
    Name: 'main',
  },
})

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

const artifact_bucket = new aws.s3.Bucket('artifacts') //, undefined, { protect: true }) // if the bucket is protected you have to remove this part apply (pulumi up) then delete (pulumi down)
const vault_bucket = new aws.s3.Bucket('vault') //, undefined, { protect: true })

const cluster = new aws.ecs.Cluster('cluster', {})

// const vault = new awsx.ecs.EC2Service('vault_service', {
//   cluster: cluster.arn,
//   desiredCount: 1,
//   taskDefinitionArgs: {
//     container: {
//       name: 'vault',
//       image: 'vault:1.13.3',
//       cpu: 128,
//       memory: 512,
//       essential: true,
//       portMappings: [
//         {
//           containerPort: 8200,
//           targetGroup: lb.defaultTargetGroup,
//         },
//       ],
//     },
//   },
// })

const twingate_securityGroup = new aws.ec2.SecurityGroup('securityGroup', {
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

const twingate = new awsx.ecs.EC2Service('twingate_service', {
  cluster: cluster.arn,
  forceNewDeployment: true,
  desiredCount: 1,
  networkConfiguration: {
    subnets: main.privateSubnetIds,
    securityGroups: [twingate_securityGroup.id],
  },
  taskDefinitionArgs: {
    container: {
      name: 'twingate-connector',
      image: 'twingate/connector:1.70.0',
      cpu: 128,
      memory: 512,
      essential: true,
      environment: [
        { name: 'TWINGATE_NETWORK', value: 'TENANT NAME' },
        { name: 'TWINGATE_ACCESS_TOKEN', value: process.env['ACCESS_TOKEN'] },
        { name: 'TWINGATE_REFRESH_TOKEN', value: 'REFRESH TOKEN' },
        { name: 'TWINGATE_LABEL_HOSTNAME', value: 'ECS' },
        { name: 'TWINGATE_NETWORK', value: 'network.twingate.com' },
      ],
      portMappings: [
        {
          protocol: 'tcp',
          containerPort: 80,
          // targetGroup: lb.defaultTargetGroup,
        },
      ],
      systemControls: [
        {
          namespace: 'net.ipv4.ping_group_range',
          value: '0 2147483647',
        },
      ],
    },
  },
})

// const nexus = new awsx.ecs.EC2Service('nexus_service', {
//   cluster: cluster.arn,
//   desiredCount: 1,
//   networkConfiguration: {
//     subnets: main.privateSubnetIds,
//   },
//   taskDefinitionArgs: {
//     container: {
//       name: 'nexus',
//       image: 'sonatype/nexus3:3.72.0-ubi',
//       cpu: 512,
//       memory: 4096,
//       essential: true,
//       portMappings: [
//         {
//           containerPort: 8081,
//           targetGroup: lb.defaultTargetGroup,
//         },
//         {
//           containerPort: 8085,
//           targetGroup: lb.defaultTargetGroup,
//         },
//       ],
//     },
//   },
// })
