const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const owner = "Utkarshnegi2k5";

const repoAName = "Repo-A";
const repoBName = "Repo-B";

const dependencyName = "repo-b";

const token = process.env.GITHUB_TOKEN;

if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
}


async function GetFileFromGithub(owner, repo, filePath) {

    const url =
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
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


async function CreatePullRequest(owner, repo, branchName, version) {

    const url =
        `https://api.github.com/repos/${owner}/${repo}/pulls`;

    const response = await fetch(url, {

        method: "POST",

        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            title: `Update ${dependencyName} to ${version}`,
            head: branchName,
            base: "main",
            body:
                `This PR was automatically created by the version checker.\n\n` +
                `Updated **${dependencyName}** to version **${version}**.`
        })
    });


    if (!response.ok) {

        const errorBody = await response.text();

        throw new Error(
            `PR creation failed: ${response.status} ${errorBody}`
        );
    }


    const pullRequest = await response.json();

    console.log(`Pull Request created: ${pullRequest.html_url}`);
}


// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {

    console.log("Starting version checker...");


    // --------------------------------------------------
    // 1. Get Repo-A package.json
    // --------------------------------------------------

    const repoA = await GetFileFromGithub(
        owner,
        repoAName,
        "package.json"
    );


    // --------------------------------------------------
    // 2. Get Repo-B package.json
    // --------------------------------------------------

    const repoB = await GetFileFromGithub(
        owner,
        repoBName,
        "package.json"
    );


    // --------------------------------------------------
    // 3. Read versions
    // --------------------------------------------------

    const repoAVersion =
        repoA.dependencies[dependencyName];

    const repoBVersion =
        repoB.version;


    console.log(
        `Repo-A requires ${dependencyName}: ${repoAVersion}`
    );

    console.log(
        `Repo-B current version: ${repoBVersion}`
    );


    // --------------------------------------------------
    // 4. Compare versions
    // --------------------------------------------------

    if (repoAVersion === repoBVersion) {

        console.log("There is no version mismatch.");
        console.log("Nothing to do.");

        return;
    }


    console.log("!!! There is a version mismatch !!!");


    // --------------------------------------------------
    // 5. Clone Repo-A
    // --------------------------------------------------

    const repoAPath =
        path.join(process.cwd(), repoAName);


    // Remove Repo-A if it already exists
    // This makes local testing easier.

    if (fs.existsSync(repoAPath)) {

        fs.rmSync(repoAPath, {
            recursive: true,
            force: true
        });
    }


    console.log("Cloning Repo-A...");


    execFileSync(
        "git",
        [
            "-c",
            `http.extraheader=AUTHORIZATION: bearer ${token}`,
            "clone",
            `https://github.com/${owner}/${repoAName}.git`,
            repoAPath
        ],
        {
            stdio: "inherit"
        }
    );


    // --------------------------------------------------
    // 6. Create branch
    // --------------------------------------------------

    const branchName =
        `update-${dependencyName}-${repoBVersion}`;
    console.log(`Creating branch: ${branchName}`);

    execFileSync(
        "git",
        [
            "-C",
            repoAPath,
            "checkout",
            "-b",
            branchName
        ],
        {
            stdio: "inherit"
        }
    );


    // --------------------------------------------------
    // 7. Read local package.json
    // --------------------------------------------------

    const packagePath =
        path.join(repoAPath, "package.json");


    const packageJson =
        JSON.parse(
            fs.readFileSync(packagePath, "utf8")
        );


    // --------------------------------------------------
    // 8. Update dependency version
    // --------------------------------------------------

    packageJson.dependencies[dependencyName] =
        repoBVersion;


    fs.writeFileSync(
        packagePath,
        JSON.stringify(packageJson, null, 2) + "\n"
    );


    console.log(
        `Updated ${dependencyName} from ${repoAVersion} to ${repoBVersion}`
    );


    // --------------------------------------------------
    // 9. Configure Git user
    // --------------------------------------------------

    execFileSync(
        "git",
        [
            "-C",
            repoAPath,
            "config",
            "user.name",
            "github-actions[bot]"
        ],
        {
            stdio: "inherit"
        }
    );


    execFileSync(
        "git",
        [
            "-C",
            repoAPath,
            "config",
            "user.email",
            "41898282+github-actions[bot]@users.noreply.github.com"
        ],
        {
            stdio: "inherit"
        }
    );

    // --------------------------------------------------
    // 10. Add package.json
    // --------------------------------------------------

    execFileSync(
        "git",
        [
            "-C",
            repoAPath,
            "add",
            "package.json"
        ],
        {
            stdio: "inherit"
        }
    );


    // --------------------------------------------------
    // 11. Commit
    // --------------------------------------------------

    execFileSync(
        "git",
        [
            "-C",
            repoAPath,
            "commit",
            "-m",
            `Update ${dependencyName} to ${repoBVersion}`
        ],
        {
            stdio: "inherit"
        }
    );


    console.log("Changes committed.");


    // --------------------------------------------------
    // 12. Push branch
    // --------------------------------------------------

    console.log("Pushing branch...");


    execFileSync(
        "git",
        [
            "-C",
            repoAPath,

            "-c",
            `http.extraheader=AUTHORIZATION: bearer ${token}`,

            "push",
            "-u",
            "origin",
            branchName
        ],
        {
            stdio: "inherit"
        }
    );


    console.log("Branch pushed successfully.");


    // --------------------------------------------------
    // 13. Create Pull Request
    // --------------------------------------------------

    await CreatePullRequest(
        owner,
        repoAName,
        branchName,
        repoBVersion
    );

    console.log("Version update process completed.");
}

// --------------------------------------------------
// Run
// --------------------------------------------------

main().catch(error => {

    console.error(error);

    process.exit(1);
});