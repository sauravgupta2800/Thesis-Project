const { Octokit } = require("@octokit/rest");
const { appendFileSync, existsSync } = require("fs");
const octokit = new Octokit({
  auth: process.env.REACT_APP_GH,
});

const path = "./dataset/collaborators";
const ecosystem = "npm";

const frameworks = {
  react: {
    owner: "facebook",
    repo: "react",
  },
  vue: {
    owner: "vuejs",
    repo: "vue",
  },
  angular: {
    owner: "angular",
    repo: "angular",
  },
};
let type = "angular";
var args = process.argv.slice(2);
let i = 0;
let pageSize = 1;
let page = 1;

if (args.length && frameworks[args[0]]) {
  type = args[0];
}
if (args.length > 1) {
  page = args[1];
}

const { owner, repo } = frameworks[type];

const onLoad = async () => {
  try {
    // default values sort=created & direction=desc & page=1
    const resp = await octokit.request(
      "/repos/{owner}/{repo}/stats/contributors",
      { owner, repo }
    );
    console.log(resp);

    const { data: contributors = [] } = resp;

    const totalCommitsByContributors = (contributors || []).map(
      (contributor) => {
        const {
          total: commits,
          author: { login: name },
          weeks,
        } = contributor;
        let additions = 0;
        let deletions = 0;
        additions = weeks.reduce((prev, { a }) => prev + a, 0);
        deletions = weeks.reduce((prev, { d }) => prev + d, 0);

        return { name, commits, additions, deletions };
      }
    );

    console.log(totalCommitsByContributors);
    makeCSV(totalCommitsByContributors);
  } catch (e) {
    console.log("FAILED", e);
  }
};

onLoad();

function makeCSV(totalCommitsByContributors) {
  console.log("Done");

  const targetPath = `${path}/${ecosystem}/${type}.csv`;

  if (!existsSync(targetPath)) {
    try {
      appendFileSync(targetPath, `name,commits,additions,deletions\n`);
    } catch (err) {
      console.error(err);
    }
  }
  totalCommitsByContributors.forEach(
    ({ name, commits, additions, deletions }) => {
      try {
        appendFileSync(
          targetPath,
          `${name},${commits},${additions},${deletions}\n`
        );
      } catch (err) {
        console.error(err);
      }
    }
  );
}
