const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");


// ===============================
// Configuration
// ===============================

const owner = "Utkarshnegi2k5";

const repoAName = "Repo-A";
const repoBName = "Repo-B";

const repoAPath = "Repo-A";

const repoApackagePath = "package.json";
const repoBpackagePath = "package.json";

const dependencyName = "repo-b";

const branchPrefix = "update-repo-b";


// ===============================
// GitHub API
// ===============================

async function GetFileFromGithub(owner, repo, filePath) {

    const url =
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${process.env.VERSION_TOKEN}`,
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`
        );
    }

    const data = await response.json();

    const content = Buffer
        .from(data.content, "base64")
        .toString("utf8");

    return JSON.parse(content);
}

// ===============================
// Create Pull Request
// ===============================

async function CreatePullRequest(
    owner,
    repo,
    branchName,
    baseBranch,
    title,
    body
) {

    const url =
        `https://api.github.com/repos/${owner}/${repo}/pulls`;

    const response = await fetch(url, {
        method: "POST",

        headers: {
            Authorization: `Bearer ${process.env.VERSION_TOKEN}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            title: title,
            body: body,
            head: branchName,
            base: baseBranch
        })
    });

    if (!response.ok) {

        const error = await response.text();

        throw new Error(
            `GitHub PR creation failed: ${response.status} ${error}`
        );
    }

    return await response.json();
}

// ===============================
// Main
// ===============================

async function main() {

    // Get Repo-A package.json

    const repoA = await GetFileFromGithub(
        owner,
        repoAName,
        repoApackagePath
    );

    console.log(`${repoAName} package.json:`);
    console.log(repoA);


    // Get Repo-B package.json

    const repoB = await GetFileFromGithub(
        owner,
        repoBName,
        repoBpackagePath
    );

    console.log(`${repoBName} package.json:`);
    console.log(repoB);


    // Version comparison

    const repoAVersion =
        repoA.dependencies[dependencyName];

    const repoBVersion =
        repoB.version;

    console.log(
        `${repoAName} requires ${repoBName}: ${repoAVersion}`
    );

    console.log(
        `${repoBName} current version: ${repoBVersion}`
    );


    // Check for mismatch

    if (repoAVersion !== repoBVersion) {

        console.log("!!! There is a version mismatch !!!");


        // Location of locally checked out Repo-A

        const packagePath = path.join(
            repoAPath,
            repoApackagePath
        );


        // Read Repo-A package.json

        const packageJson = JSON.parse(
            fs.readFileSync(packagePath, "utf8")
        );


        // Update dependency

        packageJson.dependencies[dependencyName] =
            repoBVersion;


        // Write updated package.json

        fs.writeFileSync(
            packagePath,
            JSON.stringify(packageJson, null, 2) + "\n"
        );


        // Create branch

        const branchName =
            `${branchPrefix}-${repoBVersion}`;

        execSync(
            `git -C "${repoAPath}" checkout -b "${branchName}"`
        );

        console.log(
            `Created branch: ${branchName}`
        );


        // Stage changes

        execSync(
            `git -C "${repoAPath}" add "${repoApackagePath}"`
        );


        // Configure Git user

        execSync(
            `git -C "${repoAPath}" config user.name "github-actions[bot]"`
        );

        execSync(
            `git -C "${repoAPath}" config user.email "41898282+github-actions[bot]@users.noreply.github.com"`
        );


        // Commit

        execSync(
            `git -C "${repoAPath}" commit -m "Update ${dependencyName} to version ${repoBVersion}"`
        );

        console.log(
            `Committed version update to ${repoBVersion}`
        );


        // Push branch

        execSync(
            `git -C "${repoAPath}" push origin "${branchName}"`,
            {
                stdio: "inherit"
            }
        );

        console.log(
            `Pushed branch ${branchName} to ${repoAName}`
        );

        const pullRequest = await CreatePullRequest(
            owner,
            repoAName,
            branchName,
            "main",
            `Update ${dependencyName} to version ${repoBVersion}`,
            `Automated dependency update.

        ${dependencyName} was updated from ${repoAVersion} to ${repoBVersion}.

        This pull request was created automatically by the version checker.`
        );


        console.log(
            `Pull Request created: ${pullRequest.html_url}`
        );

    } else {

        console.log(
            "There is no version mismatch"
        );

    }
}

main();