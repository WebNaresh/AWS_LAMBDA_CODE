const {
  EC2Client,
  StopInstancesCommand,
  StartInstancesCommand,
  DescribeInstancesCommand,
} = require("@aws-sdk/client-ec2");
require("dotenv").config();

const client = new EC2Client({ region: "ap-south-1" });
const auth = process.env.GITHUB_TOKEN;
const owner = process.env.OWNER;
const repo = process.env.REPO;
const workflow_id = process.env.WORKFLOW_ID;

exports.handler = async (event) => {
  const instanceId = process.env.INSTANCE_ID;

  try {
    // Stop the instance
    await stopInstance(instanceId);

    // Wait for the instance to stop
    await waitForInstanceState(instanceId, "stopped");

    // Start the instance
    await startInstance(instanceId);

    // Wait for the instance to start
    await waitForInstanceState(instanceId, "running");

    // Trigger GitHub action
    await triggerGitHubAction();

    return {
      statusCode: 200,
      body: `Stopped and started instance ${instanceId}, and triggered GitHub action`,
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: error.message,
    };
  }
};

async function stopInstance(instanceId) {
  try {
    await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
  } catch (error) {
    throw new Error(`Failed to stop instance ${instanceId}: ${error.message}`);
  }
}

async function startInstance(instanceId) {
  try {
    await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
  } catch (error) {
    throw new Error(`Failed to start instance ${instanceId}: ${error.message}`);
  }
}

async function waitForInstanceState(instanceId, desiredState) {
  try {
    let instanceState;
    do {
      const describeResponse = await client.send(
        new DescribeInstancesCommand({ InstanceIds: [instanceId] })
      );
      instanceState = describeResponse.Reservations[0].Instances[0].State.Name;
      if (instanceState !== desiredState) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } while (instanceState !== desiredState);
  } catch (error) {
    throw new Error(
      `Error while waiting for instance ${instanceId} to reach ${desiredState} state: ${error.message}`
    );
  }
}

async function triggerGitHubAction() {
  try {
    const { Octokit } = await import("octokit");

    const octokit = new Octokit({
      auth,
    });
    // const r = await octokit.request(
    //   `GET /repos/${owner}/${repo}/actions/runs`,
    //   {
    //     owner,
    //     repo,
    //     headers: {
    //       "X-GitHub-Api-Version": "2022-11-28",
    //     },
    //   }
    // );
    // // console.log(`🚀 ~ file: index.js:98 ~ r:`, r);
    // console.log(
    //   `🚀 ~ file: index.js:114 ~ r.data.workflow_runs:`,
    //   r.data.workflow_runs
    // );
    const request = await octokit.request(
      `POST /repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
      {
        ref: "prod-branch",
      }
    );
    console.log(`🚀 ~ file: index.js:93 ~ request:`, request);

    console.log("Triggering GitHub action...");
  } catch (error) {
    console.log(`🚀 ~ file: index.js:107 ~ error:`, error);
    throw new Error(`Failed to trigger GitHub action: ${error.message}`);
  }
}

triggerGitHubAction();
