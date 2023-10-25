
function readJSON(path){
    return fetch(chrome.runtime.getURL(path))
    .then((response) => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('JSON Response failed');
        }
    })
    .catch((error) => {
        console.log('JSON Fetch error: ' + error.message);
    });
}

chrome.runtime.onInstalled.addListener(() => {
    readJSON("tokens.json").then((tokens) => {
        for (let key in tokens) {
            const token = tokens[key]
            chrome.storage.local.set({[key]: token}, () => {
                console.log(key + ' API token has been saved.');
            });
          }  
    })
});

async function getToken(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, function(result) {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result[key]);
        });
    });
}

async function summarize(text, textLength) {

    if (textLength < 100){
        return "Not enough changes to make summary";
    }
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    const OPENAI_API_KEY = await getToken("OPENAI");
  
    const message = {
        model: 'gpt-3.5-turbo-16k', 
        messages:[
        {
                "role": "system",
                "content": "You are a code explainer. Do not discuss specific files or code. Assume your answer is being written as part of a chart so be brief"
        }, 
        {"role": "user", 
          "content": text + "\n\n\n ----END OF CODE DIFFS---- I haved provided information such as code diffs (changes) and commits to a github repos' fork. Please succintly identify the general focus of the fork based on the information the information provided and summarize the type of work being done it.  Make sure it is useful and focus on what differentiates it from the fork based off the information provided (without referencing the diffs). Keep redundant information low but mention what is being worked on (in the context of the main focus of the fork only). Be as concise as possible similar to bullet point format but use sentences. Do not mention specific files. Start with 'This fork is focused on...'  \n\n"}
        ],
        max_tokens: 80,
        temperature: 0
    };
    
    
    let response = await fetch(API_URL, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(message)
  });
  
    let data = await response.json(); 

    if (data.choices && data.choices.length > 0) {
        console.log("GPT RESPONSE: \n\n", data.choices[0].message.content.trim());
        return data.choices[0].message.content.trim();
    } else {
        console.log("NO SUMMARY ERROR: ", data);
        return 'No summary available';
    }

  }

  async function getGithubToken() {
    return await getToken('GITHUB');
}

async function summarizeQuery(query, text) {

    if (text.length < 100){
        return "Not enough changes to make summary";
    }
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    const OPENAI_API_KEY = await getToken("OPENAI");
  
    const message = {
        model: 'gpt-3.5-turbo-16k', 
        messages:[
        {
                "role": "system",
                "content": "You are a helpful assistant:"
        }, 
        {"role": "user", 
          "content": `Here is a user question: \n\n ${query} \n\n. Answer the user's questions based on the github code diffs and other title information provided.: \n\n ` + text }
        ],
        max_tokens: 100
    };
    
    
    let response = await fetch(API_URL, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(message)
  });
  
    let data = await response.json(); // Changed to use `response`

    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
    } else {
        return 'No summary available';
    }

  }

  async function getGithubToken() {
    return await getToken('GITHUB');
}


async function fetchForks(githubToken, repo, page = 1, sortBy='newest') {

    const response = await fetch(`https://api.github.com/repos/${repo}/forks?page=${page}&sort=${sortBy}&per_page=3`, {
        headers: {
            'Authorization': 'token ' + githubToken
        }
    });
    
    if (!response.ok) {
        const responseBody = await response.text();
        console.error('Failed to fetch forks. Status: ', response.status);
        console.error('Response body: ', responseBody);
        throw new Error('GitHub API request failed: ' + response.status);
    }
    
    const forks = await response.json();
    const forkDetailPromises = forks.map(fork => getRepoDetails(fork.full_name, githubToken));
    const enrichedForks = await Promise.all(forkDetailPromises);

    const linkHeader = response.headers.get('Link');
    const hasNextPage = linkHeader && linkHeader.includes('rel="next"');
    return { forks: enrichedForks, hasNextPage };
}


async function queryDb(query){
    let url = await getToken("PINECONE-URL")
    let pineconeToken = await getToken("PINECONE-TOKEN");
    return fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer TOKEN',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: query
        })
    })
    .then(response => response.json())
    .then(embeddingData => {
        const embedding = embeddingData.data[0].embedding;
        console.log("Embedding: ", embedding)
        
    // Query Pinecone DB
     return fetch(`${url}/query`, {
            method: 'POST',
            headers: {
                'Api-Key': pineconeToken,
            },
            body: JSON.stringify({
                // namespace: fork.full_name,
                vector: embedding,
                topK: 5,
                includeValues: false,
                includeMetadata: true
            })
        });
    })
    .then(pineconeResponse => pineconeResponse.json())
    .then(pineconeData => {
       console.log(`Queried Pinecone DB with result: ${JSON.stringify(pineconeData, null, 2)}`);
        // Accessing the original text from metadata 
        return pineconeData.matches;
    })
    .catch(error => {
        console.error(`Error processing query: ${error}`);
    });
}

async function upsertFileContent(fileContent, fork, fileName, pineconeToken, url){
    return fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer <TOKEN>',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: fileContent
        })
    })
    .then(response => response.json())
    .then(embeddingData => {
        console.log("Embedding: ", embeddingData); 
        const embedding = embeddingData.data[0].embedding;
        console.log(`Fork: ${fork.full_name}, filename: ${fileName}`);
        console.log("FILE CONTENT: ", fileContent);
        // Upsert to Pinecone DB
        fetch(`${url}/vectors/upsert`, {
            method: 'POST',
            headers: {
                'Api-Key':  pineconeToken
            },
            body: JSON.stringify({
                vectors: [{
                    id: `${fork.full_name}-${fileName}`,
                    values: embedding,
                    metadata: {
                        repository: fork.full_name,
                        file: fileName,
                        originalText: fileContent  
                    }
                }],
                //namespace: fork.full_name
            })
        })
        .then(pineconeResponse => pineconeResponse.json())
        .then(pineconeData => {
            console.log(`Upserted to Pinecone DB with result: ${JSON.stringify(pineconeData, null, 2)}</pre>`);
            return pineconeData
        })
        .catch(error => {
            console.error(`Error upserting to Pinecone DB: ${error}`);
        });
    })
}

async function fetchCommits(originalRepo, fork, githubToken) {
    const response = await fetch(`https://api.github.com/repos/${fork.full_name}/commits`, {
        headers: {
            'Authorization': 'token ' + githubToken
        }
    });
    
    const commits = await response.json();
    let lastCommit = 'N/A';
    let commitMessages = ''

    if (Array.isArray(commits)) {
        lastCommit = commits[0].commit.author.date
        commitMessages = commits.map(commit => commit.commit.message).join('\n\n');
    }

    console.log("info: ", originalRepo, fork);

    const diffStats = await fetchDiffStats(originalRepo, fork, githubToken);
    var diffs = "";
    let readMeText = "";
    console.log(`Diff stats for ${fork.full_name}: `, diffStats); 
    
    // Array of commonly used code file extensions
    const codeExtensions = ['.js', '.py', '.java', '.cpp', '.ts', '.cs', '.rb', '.php', '.go', '.r', '.swift', '.kt', '.m', '.c', '.h', '.rs', '.scala', '.hs', '.lua', '.pl', '.sh'];
    
    let pineconeToken = await getToken("PINECONE-TOKEN");
    let pineconeURL = await getToken("PINECONE-URL");
    
    // Loop through the changed files
    diffStats.files.forEach(async file => {
        // Check for code files or README.md
        if (codeExtensions.some(ext => file.filename.endsWith(ext)) || file.filename == "README.md") {
            if (file.patch && file.patch.length > 50){
                console.log("File:", file.filename);
                
                if (file.filename == "README.md"){
                    readMeText =  `\n\n ----------- Fork Name: ${fork.full_name}------------- Filename: ${file.filename}-------------------\n\n` + file.patch.substring(0, 10000)
                    diffs = readMeText + diffs
                }
                else{
                    diffs += `\n\n ----------- Fork Name: ${fork.full_name}------------- Filename: ${file.filename}-------------------\n\n`
                    diffs += file.patch.substring(0, 10000);
                }

                await upsertFileContent(file.patch.substring(0, 20000), fork, file.filename, pineconeToken, pineconeURL);
            }
        }
    });
    

    console.log(`Summary of ${fork.full_name}:\n\n`, diffs.substring(0, 50000));
    let matches = await queryDb("Which code is handling crawling?", fork);
    console.log("matches for ", fork.full_name, ": \n", matches);

    let finalGPTstring = "---------- COMMIT MESSAGES ---------- \n\n" + commitMessages.substring(0, 5000) + "----------- CODE DIFFS ---------- \n\n" + diffs.substring(0, 50000);
    return {
        ...fork,
        last_commit: lastCommit,
        commit_summary: await summarize(finalGPTstring, diffs.length),
        ahead_by: diffStats.ahead_by,
        behind_by: diffStats.behind_by
    };
}

async function getRepoDetails(repoFullName, githubToken) {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        headers: {
            'Authorization': 'token ' + githubToken
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch repo details: ${response.status}`);
    }

    const repoDetails = await response.json();
    return repoDetails;
}

async function getLatestCommitSHA(repoFullName, githubToken) {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}/commits`, {
        headers: {
            'Authorization': 'token ' + githubToken
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch commits: ${response.status}`);
    }

    const commits = await response.json();
    return commits[0].sha;
}

async function fetchDiffStats(originalRepo, fork, githubToken) {
    const originalRepoFullName = originalRepo.full_name;
    const forkFullName = fork.full_name;

    const originalRepoLatestSHA = await getLatestCommitSHA(originalRepoFullName, githubToken);
    const forkLatestSHA = await getLatestCommitSHA(forkFullName, githubToken);

    try {
        const response = await fetch(`https://api.github.com/repos/${forkFullName}/compare/${originalRepoLatestSHA}...${forkLatestSHA}`, {
            headers: {
                'Authorization': 'token ' + githubToken
            }
        });

        if (!response.ok) {
            // If a 404 status is returned, interpret it as no difference
            if (response.status === 404) {
                console.log(`Error attempting to compare between ${originalRepoFullName} and ${forkFullName}.`);
                return {
                    status: 'identical',
                    ahead_by: 'N/A',
                    behind_by: 'N/A',
                    files: []
                };
            }
            throw new Error(`Failed to fetch diff stats: ${response.status}`);
        }

        const diffStats = await response.json();
        return diffStats;

    } catch (error) {
        console.error(error);
        return {
            status: 'error',
            error_message: error.message,
            ahead_by: null,
            behind_by: null,
            files: []
        };
    }
}


function extractFilePaths(diffStats) {
    // Extract all file paths from the diff stat object
    return diffStats.files.map(file => file.filename);
}

function calculateOverlap(files1, files2) {
    // Calculate the overlap between two file sets
    const set1 = new Set(files1);
    const set2 = new Set(files2);

    let intersection = new Set([...set1].filter(x => set2.has(x)));

    return intersection.size / Math.min(set1.size, set2.size);
}



chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === 'clearPopupState'){
        chrome.storage.local.remove(["forks", "hasNextPage", "currentPage", "sortBy"], function() {
            console.log('Popup State removed from local storage');
        });        
    }
    else if (message.action === 'getForks') {
        const request = message;
        const page = request.page || 1;
        getGithubToken().then(githubToken => {
            fetchForks(githubToken, request.repo, page, request.sortBy)
            .then(async ({ forks, hasNextPage }) => {
                console.log('Forks:', forks);
                const originalRepoDetails = await getRepoDetails(request.repo, githubToken);
                const promises = forks.map(fork => fetchCommits(originalRepoDetails, fork, githubToken));
                
                // Wait for all forks to be enriched
                const enrichedForks = await Promise.all(promises);

                // Store the enriched forks and related information in chrome.storage.local
                chrome.storage.local.set({
                    forks: enrichedForks,
                    hasNextPage: hasNextPage,
                    currentPage: request.page,
                    sortBy: request.sortBy
                }, function() {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to store popup state: ', chrome.runtime.lastError);
                    } else {
                        console.log('Popup state stored successfully');
                    }
                });

                console.log('Sending response: ', { forks: enrichedForks, hasNextPage: hasNextPage }); 
                sendResponse({ forks: enrichedForks, hasNextPage: hasNextPage });
            })
            .catch((error) => {
                sendResponse({error: error.toString()});
            });
        });

        // To indicate that we're going to call `sendResponse` asynchronously
        return true;  
    }
    else if (message.action == "getMatches"){
        
        queryDb(message.query).then(matches => {
            let newStr = ""
            matches.forEach(match => {
                    newStr += `\n\n -------- Fork: ${match.metadata.repository}  Filename: ${match.id}-------------------\n\n`
                    newStr += match.metadata.originalText
            });

            summarizeQuery(message.query, newStr).then(result => {
                console.log("GPTRESULT: ", result);
                sendResponse({result: result});
            });
           
        });
        console.log("Returning Matches");
        return true

    }

});
