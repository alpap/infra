#!/usr/bin/env bash

set -ex

WANTED_TASKS="vault nexus" # space seperated
REMOTE_NETWORK_NAME="test"

if [ ! "$(command -v jq)" ]; then
  sudo apt install -y jq
fi

CLUSTER_NAME=$(aws ecs list-clusters --output=json | jq -r .clusterArns[0] | cut -d'/' -f2)

TASKS=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --output=json | jq -r .taskArns[])

for TASK in $(echo "$TASKS"); do
  TASK_DETAILS=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --task "$TASK" --output=json)
  # this is the name of the container ex Nexus
  TASK_NAME=$(echo "$TASK_DETAILS" | jq -r .tasks[0].overrides.containerOverrides[0].name)
  echo "Found task $TASK_NAME"
  if [[ "$WANTED_TASKS" == *"$TASK_NAME"* ]]; then
    IP=$(echo "$TASK_DETAILS" | jq -r .tasks[0].attachments[0].details[3].value)

    #! CHANGE THIS IF NEED TO
    tg resource remove "$TASK_NAME"
    tg resource create "$REMOTE_NETWORK_NAME" "$TASK_NAME" "$IP" # this creates a new

  fi
done
