import React, { useEffect, useState } from "react";
import { octokit } from "../utils/octokit";

const Comparator = () => {
  const [comments, setComments] = useState([]);
  const [totalResponseTimeTaken, setResponsetime] = useState([]);

  async function onLoad() {
    const data = {
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
    const type = "react";
    const { owner, repo } = data[type];

    const { data: issues } = await octokit.request(
      "GET /repos/{owner}/{repo}/issues?per_page=100",
      { owner, repo }
    );

    let totalResponseTimeTaken = 0;

    console.log("issues: ", issues);
    let totalIssuesWithComment = 0;

    issues.forEach(async (issue, index) => {
      const { data: comments } = await octokit.request(
        `GET /repos/{owner}/{repo}/issues/{issue_number}/comments?per_page=20`,
        {
          owner,
          repo,
          issue_number: issue.number,
          // issue_number: 26224,
        }
      );

      console.log(issue);

      const issueCreatedAt = new Date(issue.created_at);
      //console.log(issueCreatedAt);
      if (comments.length) {
        totalIssuesWithComment++;

        let firstCommentDate = getFirstCollabortorResponseTime(comments);
        if (firstCommentDate) {
          firstCommentDate = new Date(firstCommentDate);
          // hours
          const timeTaken = Math.abs(firstCommentDate - issueCreatedAt) / 36e5;
          totalResponseTimeTaken += timeTaken;

          // console.log("issueCreatedAt: ", issueCreatedAt);
          // console.log("firstCommentDate: ", firstCommentDate);
        }

        // console.log("timeTaken: ", timeTaken);
      }

      console.log("comments: ", comments);

      if (index === issues.length - 1) {
        setResponsetime(totalResponseTimeTaken / totalIssuesWithComment);
      }
    });

    console.log("totalResponseTimeTaken: ", totalResponseTimeTaken);
  }

  const getFirstCollabortorResponseTime = (comments) => {
    const associations = ["COLLABORATOR", "MEMBER"];
    let collaboratorComment = comments.find(({ author_association }) =>
      associations.includes(author_association)
    );
    let time = 0;
    if (collaboratorComment) {
      time = collaboratorComment.created_at;
    }
    return time;
  };

  useEffect(() => {
    onLoad();
  }, []);

  return (
    <>
      <div>{totalResponseTimeTaken}</div>
    </>
  );
};

export default Comparator;
