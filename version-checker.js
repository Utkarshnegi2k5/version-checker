const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const owner = "Utkarshnegi2k5";

async function GetFileFromGithub(owner, repo, filePath) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

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


async function main() {

    const repoApath = "package.json";
    const repoBpath = "package.json";


    // Get Repo-A package.json

    const repoA = await GetFileFromGithub(
        owner,
        "Repo-A",
        repoApath
    );

    console.log("Repo-A package.json:");
    console.log(repoA);


    // Get Repo-B package.json

    const repoB = await GetFileFromGithub(
        owner,
        "Repo-B",
        repoBpath
    );

    console.log("Repo-B package.json:");
    console.log(repoB);


    // Version comparison

    const repoAVersion = repoA.dependencies["repo-b"];
    const repoBVersion = repoB.version;

    console.log(`Repo-A requires Repo-B: ${repoAVersion}`);
    console.log(`Repo-B current version: ${repoBVersion}`);


    // Check version mismatch

    if (repoAVersion !== repoBVersion) {

        console.log("!!! There is a version mismatch !!!");


        // Repo-A location on GitHub Actions runner

        const repoAPath = path.join(
            process.cwd(),
            "..",
            "Repo-A"
        );


        // package.json inside Repo-A

        const packagePath = path.join(
            repoAPath,
            "package.json"
        );


        // Read Repo-A package.json

        const packageJson = JSON.parse(
            fs.readFileSync(packagePath, "utf8")
        );


        // Update dependency

        packageJson.dependencies["repo-b"] = repoBVersion;


        // Write updated package.json

        fs.writeFileSync(
            packagePath,
            JSON.stringify(packageJson, null, 2) + "\n"
        );

        console.log(
            `Updated repo-b from ${repoAVersion} to ${repoBVersion}`
        );


        // Create branch

        const branchName =
            `update-repo-b-${repoBVersion}`;


        execSync(
            `git -C "${repoAPath}" checkout -b "${branchName}"`,
            {
                stdio: "inherit"
            }
        );

        console.log(
            `Created branch: ${branchName}`
        );


    } else {

        console.log("There is no version mismatch");

    }
}


main().catch(error => {

    console.error(error);

    process.exit(1);

});