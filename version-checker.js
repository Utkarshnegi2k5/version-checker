async function GetFileFromGithub(owner, repo, path) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`
        );
    }

    const data = await response.json();

    const content = Buffer.from(data.content, "base64").toString("utf8");

    return JSON.parse(content);
}

async function main() {
    const owner = "Utkarshnegi2k5";
    const repoApath = "package.json";
    const repoBpath = "package.json";

    const repoA = await GetFileFromGithub(
        owner,  
        "Repo-A",           //repo variable 
        repoApath           //path variable 
    );

    console.log(repoA);

    const repoB = await GetFileFromGithub(
        owner,  
        "Repo-B",           //repo variable 
        repoBpath           //path variable 
    );

    console.log(repoB);

    if(repoA.dependencies["repo-b"] !== repoB.version)
    {
        console.log("!!! There is a version mismatch !!!")
    }
    else
    {
        console.log("There is no version mismatch")
    }
}

main().catch(console.error);