const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");


// ===============================
// Configuration
// ===============================

const owner = "Utkarshnegi2k5";

const repositories = [
    "Repo-A",
    "Repo-B",
    "Repo-C"
];

const packagePath = "package.json";


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
            `GitHub API error for ${repo}: ${response.status} ${response.statusText}`
        );
    }

    const data = await response.json();

    const content = Buffer
        .from(data.content, "base64")
        .toString("utf8");

    return JSON.parse(content);
}

// ===============================
// Phase 4: Create Pull Request
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
            `GitHub PR creation failed for ${repo}: ${response.status} ${error}`
        );
    }

    return await response.json();
}

// ===============================
// Main
// ===============================

async function main() {

    console.log("Starting repository discovery...\n");


    // Store all repository information

    const repositoryData = {};


    // Read every repository

    for (const repoName of repositories) {

        console.log(`Reading ${repoName}...`);

        const packageJson = await GetFileFromGithub(
            owner,
            repoName,
            packagePath
        );

        repositoryData[repoName] = packageJson;

        console.log(
            `${repoName} version: ${packageJson.version}`
        );

        console.log(
            `${repoName} dependencies:`,
            packageJson.dependencies || {}
        );

        console.log("");
    }

    const packageToRepository = {};

    for (const repoName of repositories) {

        const packageJson = repositoryData[repoName];

        if (!packageJson.name) {
            console.log(
                `Warning: ${repoName} does not have a package name`
            );

            continue;
        }

        packageToRepository[packageJson.name] = repoName;
    }


    console.log("=================================");
    console.log("Package → Repository Map");
    console.log("=================================\n");


    for (const packageName in packageToRepository) {

        console.log(
            `${packageName} → ${packageToRepository[packageName]}`
        );
    }

    // =================================
    // Build dependency map
    // =================================

    const dependencyMap = {};

    for (const repoName of repositories) {

        const packageJson = repositoryData[repoName];

        const dependencies = packageJson.dependencies || {};

        dependencyMap[repoName] = [];


        for (const dependencyName of Object.keys(dependencies)) {

            const dependencyRepository =
                packageToRepository[dependencyName];


            // Dependency belongs to one of our repositories

            if (dependencyRepository) {

                dependencyMap[repoName].push({
                    repository: dependencyRepository,
                    requiredVersion: dependencies[dependencyName]
                });
            }
        }
    }
    // =================================
    // Display dependency map
    // =================================

    console.log("\n=================================");
    console.log("Dependency Map");
    console.log("=================================\n");


    for (const repoName of repositories) {

        const dependencies = dependencyMap[repoName];

        if (dependencies.length === 0) {

            console.log(
                `${repoName} → No internal dependencies`
            );

            continue;
        }


        for (const dependency of dependencies) {

            console.log(
                `${repoName} → ${dependency.repository} ` +
                `(required: ${dependency.requiredVersion})`
            );
        }
    }

    // =================================
    // Phase 3: Check version mismatches
    // =================================

    const versionMismatches = [];

    console.log("\n=================================");
    console.log("Version Check");
    console.log("=================================\n");


    for (const repoName of repositories) {

        const dependencies = dependencyMap[repoName];


        for (const dependency of dependencies) {

            const dependencyRepository =
                dependency.repository;

            const requiredVersion =
                dependency.requiredVersion;

            const actualVersion =
                repositoryData[dependencyRepository].version;


            console.log(
                `${repoName} → ${dependencyRepository}`
            );

            console.log(
                `Required version: ${requiredVersion}`
            );

            console.log(
                `Actual version:   ${actualVersion}`
            );


            if (requiredVersion !== actualVersion) {

                console.log("Status: MISMATCH ❌");

                versionMismatches.push({
                    dependentRepository: repoName,
                    dependencyRepository: dependencyRepository,
                    requiredVersion: requiredVersion,
                    actualVersion: actualVersion
                });

            } else {

                console.log("Status: OK ✅");
            }

            console.log("");
        }
    }


    // =================================
    // Display mismatches
    // =================================

    console.log("=================================");
    console.log("Version Mismatches");
    console.log("=================================\n");


    if (versionMismatches.length === 0) {

        console.log("No version mismatches found.");

    } else {

        for (const mismatch of versionMismatches) {

            console.log(
                `${mismatch.dependentRepository} requires ` +
                `${mismatch.dependencyRepository} ` +
                `${mismatch.requiredVersion}, ` +
                `but current version is ` +
                `${mismatch.actualVersion}`
            );
        }
            // =================================
            // Process mismatches
            // =================================

            for (const mismatch of versionMismatches) {

                const dependentRepository =
                    mismatch.dependentRepository;

                const dependencyRepository =
                    mismatch.dependencyRepository;

                const oldVersion =
                    mismatch.requiredVersion;

                const newVersion =
                    mismatch.actualVersion;


                console.log("\n=================================");
                console.log("Processing mismatch");
                console.log("=================================");

                console.log(
                    `${dependentRepository} -> ${dependencyRepository}`
                );


                // =================================
                // Repo-A path
                // =================================

                const repositoryPath =
                    path.join(dependentRepository);


                const localPackagePath =
                    path.join(
                        repositoryPath,
                        packagePath
                    );


                // =================================
                // Read package.json
                // =================================

                const packageJson =
                    JSON.parse(
                        fs.readFileSync(
                            localPackagePath,
                            "utf8"
                        )
                    );


                // =================================
                // Update dependency
                // =================================

                packageJson.dependencies[
                    packageJson.dependencies[
                        dependencyRepository
                    ]
                        ? dependencyRepository
                        : Object.keys(packageJson.dependencies)
                            .find(
                                name =>
                                    packageToRepository[name] ===
                                    dependencyRepository
                            )
                ] = newVersion;


                // =================================
                // Write package.json
                // =================================

                fs.writeFileSync(
                    localPackagePath,
                    JSON.stringify(packageJson, null, 2) + "\n"
                );


                // =================================
                // Create branch
                // =================================

                const branchName =
                    `update-${dependencyRepository}-${newVersion}`;


                execSync(
                    `git -C "${repositoryPath}" checkout -b "${branchName}"`
                );


                console.log(
                    `Created branch: ${branchName}`
                );


                // =================================
                // Git configuration
                // =================================

                execSync(
                    `git -C "${repositoryPath}" config user.name "github-actions[bot]"`
                );

                execSync(
                    `git -C "${repositoryPath}" config user.email "41898282+github-actions[bot]@users.noreply.github.com"`
                );


                // =================================
                // Commit
                // =================================

                execSync(
                    `git -C "${repositoryPath}" add "${packagePath}"`
                );


                execSync(
                    `git -C "${repositoryPath}" commit -m "Update ${dependencyRepository} to version ${newVersion}"`
                );


                console.log(
                    `Committed update in ${dependentRepository}`
                );


                // =================================
                // Push
                // =================================

                execSync(
                    `git -C "${repositoryPath}" push origin "${branchName}"`,
                    {
                        stdio: "inherit"
                    }
                );


                console.log(
                    `Pushed branch ${branchName}`
                );


                // =================================
                // Create PR
                // =================================

                const pullRequest =
                    await CreatePullRequest(
                        owner,
                        dependentRepository,
                        branchName,
                        "main",

                        `Update ${dependencyRepository} to version ${newVersion}`,

                        `Automated dependency update.

                        ${dependencyRepository} was updated from ${oldVersion} to ${newVersion}.

                        Dependent repository: ${dependentRepository}

                        This pull request was created automatically by the version checker.`
                    );


                console.log(
                    `Pull Request created: ${pullRequest.html_url}`
                );
            }
    }    
}

main();