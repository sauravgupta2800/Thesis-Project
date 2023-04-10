const { Octokit } = require("@octokit/rest");
const { appendFileSync, readdirSync, existsSync } = require("fs");
const octokit = new Octokit({
  auth: "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",
  //auth: process.env.REACT_APP_GH,
  //   userAgent: "skylight v1",
});

const dataMap = {};

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
let type = "react";
var args = process.argv.slice(2);
let i = 0;
let pageSize = 100;
let page = 1;

if (args.length && frameworks[args[0]]) {
  type = args[0];
}
if (args.length > 1) {
  page = args[1];
}

console.log(page);

const { owner, repo } = frameworks[type];

const onLoad = async () => {
  try {
    // default values sort=created & direction=desc & page=1
    const { data: issues } = await octokit.request(
      "GET /repos/{owner}/{repo}/issues?state=all&per_page=" +
        pageSize +
        "&page=" +
        page,
      { owner, repo }
    );

    issues.forEach(async (issue, index) => {
      dataMap[issue.number] = issue;
      getComments(issue.number);
    });
  } catch (e) {
    console.log("FAILED", e);
  }
};

onLoad();
console.log("Hello World");
// ====================================================================

async function getComments(issue_number) {
  try {
    const { data: comments } = await octokit.request(
      `GET /repos/{owner}/{repo}/issues/{issue_number}/comments?per_page=100`,
      {
        owner,
        repo,
        issue_number,
        //issue_number: 1739,
      }
    );
    //console.log(comments);
    //console.log(comments.map((c) => c.author_association));
    dataMap[issue_number] = {
      ...dataMap[issue_number],
      comments,
    };
  } catch {
    dataMap[issue_number] = {
      ...dataMap[issue_number],
      comments: [],
    };
  } finally {
    getPRTime(issue_number);
  }
}

async function getPRTime(issue_number) {
  try {
    const { data: pr } = await octokit.request(
      `GET /repos/{owner}/{repo}/pulls/{pull_number}`,
      {
        owner,
        repo,
        pull_number: issue_number,
      }
    );
    dataMap[issue_number] = {
      ...dataMap[issue_number],
      pr_time: pr.created_at,
    };
  } catch {
    dataMap[issue_number] = {
      ...dataMap[issue_number],
      pr_time: "",
    };
  } finally {
    i++;
    //console.log(i);
    if (i == pageSize) {
      makeCSV();
    }
  }
}

function makeCSV() {
  console.log("Done");
  function isEmpty(path) {
    return !existsSync(path) || readdirSync(path).length === 0;
  }

  if (!existsSync(`./${type}.csv`)) {
    try {
      appendFileSync(
        `./${type}.csv`,
        `id,${LIFECYCLE_STATE.OPEN},${LIFECYCLE_STATE.DISCUSSION},${LIFECYCLE_STATE.PULL_REQUEST},${LIFECYCLE_STATE.MERGED},${LIFECYCLE_STATE.CLOSED},firstInsiderResponse,totalResponseByContributor,totalResponseByCollaborator,totalResponseByMembers,totalResponseByAuthor,totalResponseByOthers\n`
      );
    } catch (err) {
      console.error(err);
    }
  }
  for (const key in dataMap) {
    const d = dataMap[key];
    const issueEntry = new Issue(d);
    issueEntry.saveAsCSV(type);
  }
}

// ====================================================================

const LIFECYCLE_STATE = {
  OPEN: "opened",
  DISCUSSION: "discussion",
  PULL_REQUEST: "pullrequest",
  MERGED: "merged",
  CLOSED: "closed",
};

class Issue {
  id = "";
  constructor(issue) {
    const { number: id } = issue;
    this.id = id;
    this.getCurrentLifecycleState(issue);
  }

  getCurrentLifecycleState({
    state = "closed",
    pull_request = false,
    assignee = false,
    created_at = "",
    closed_at = "",
    pr_time = "",
    comments = [],
    user = {},
  }) {
    const isClosed = state == "closed";
    const isMerged = !!pull_request && !!pull_request["merged"];
    const isPullRequest = !!pull_request;
    const isAssigned = !!assignee;

    this[LIFECYCLE_STATE.CLOSED] = isClosed ? closed_at : "";
    this[LIFECYCLE_STATE.MERGED] = isMerged ? pull_request["merged_at"] : "";
    this[LIFECYCLE_STATE.PULL_REQUEST] = isPullRequest ? pr_time : "";
    this[LIFECYCLE_STATE.DISCUSSION] = comments.length
      ? comments[0].created_at
      : "";
    this[LIFECYCLE_STATE.OPEN] = created_at;

    //comments
    this.setComments(comments, user);
  }

  setComments(comments, user) {
    let firstInsiderResponse = "";
    if (comments.length) {
      firstInsiderResponse =
        (
          comments.find(({ author_association }) =>
            ["CONTRIBUTOR", "COLLABORATOR", "MEMBER"].includes(
              author_association
            )
          ) || {}
        ).created_at || "";
    }
    this.firstInsiderResponse = firstInsiderResponse;
    this.totalResponseByContributor = comments.filter(
      ({ author_association }) => author_association === "CONTRIBUTOR"
    ).length;
    this.totalResponseByCollaborator = comments.filter(
      ({ author_association }) => author_association === "COLLABORATOR"
    ).length;
    this.totalResponseByMembers = comments.filter(
      ({ author_association }) => author_association === "MEMBER"
    ).length;

    this.totalResponseByAuthor = comments.filter((c) => isAuthor(c)).length;

    this.totalResponseByOthers = comments.filter(
      (c) => !isAuthor(c) && c.author_association === "NONE"
    ).length;

    function isAuthor(comment) {
      return user.login === comment.user.login;
    }
  }

  saveAsCSV(name) {
    const csv = `${this.id},${this[LIFECYCLE_STATE.OPEN]},${
      this[LIFECYCLE_STATE.DISCUSSION]
    },${this[LIFECYCLE_STATE.PULL_REQUEST]},${this[LIFECYCLE_STATE.MERGED]},${
      this[LIFECYCLE_STATE.CLOSED]
    },${this.firstInsiderResponse},${this.totalResponseByContributor},${
      this.totalResponseByCollaborator
    },${this.totalResponseByMembers},${this.totalResponseByAuthor},${
      this.totalResponseByOthers
    }\n`;
    try {
      appendFileSync(`./${name}.csv`, csv);
    } catch (err) {
      console.error(err);
    }
  }
}
