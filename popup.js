let currentPage = 1;

document.addEventListener('DOMContentLoaded', function() {
    console.log("POPUP LOADED");
       // Get the stored forks and related information from chrome.storage.local
      chrome.storage.local.get(['forks', 'hasNextPage', 'currentPage', 'sortBy'], function(data) {
          if (chrome.runtime.lastError) {
              console.error('Failed to get popup state: ', chrome.runtime.lastError);
          } else {
              if (data.forks && data.forks.length > 0) {
                  console.log("Loading forks from local storage");
                  // Update the currentPage variable and select element value
                  currentPage = data.currentPage || currentPage;
                  document.getElementById('sortOptions').value = data.sortBy || "newest";
  
                  // Display the forks
                  displayForks(data.forks);
                  document.getElementById('fork-table').style.display = 'inline-block';
                  document.getElementById('searchSection').style.display = 'inline-block';
                  document.getElementById('next-page').disabled = !data.hasNextPage;

              } else {
                  console.log("Retrieving forks for the first time");
                  // If no forks are stored, fetch them
                  fetchForksOfCurrentRepo("stargazers");
              }
          }
      });

    document.getElementById('prev-page').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            fetchForksOfCurrentRepo();
        }
    });
    document.getElementById('next-page').addEventListener('click', function() {
        currentPage++;
        fetchForksOfCurrentRepo();
    });

    document.getElementById('sortOptions').addEventListener('change', (event) => {
      fetchForksOfCurrentRepo(event.target.value);
    });
    
    const searchButton = document.getElementById('searchButton');
    const searchBar = document.getElementById('searchBar');
    const searchResults = document.getElementById('searchResults');

    searchButton.addEventListener('click', function() {
        const query = searchBar.value.toLowerCase(); // Get the search term
        if (!query) return;
    
        chrome.runtime.sendMessage({ action: "getMatches", query: query }, function(response) {
            if (response.error) {
                console.error('Error from background: ', response.error);
                return;
            }
    
            if (!response.result) {
                console.error('Unexpected response: ', response);
                return;
            }
            
            displaySearchResults(response.result);
                
        });
    });
    
});


function displaySearchResults(results) {
    console.log("SEARCH HEREEEEEEEE", results);
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = ''; // Clear previous results
    const div = document.createElement('div');
    div.textContent = results;
    searchResults.appendChild(div);
    
}

function fetchForks() {
    var repo = document.getElementById('repo').value;
    fetchForksOfRepo(repo);
  }
  
  function fetchForksOfCurrentRepo(sortBy="newest") {
    document.getElementById('loader').style.display = 'flex';
    document.getElementById('fork-table').style.display = 'None';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      var url = new URL(tabs[0].url);
      var path = url.pathname.split('/');
      if (url.hostname === 'github.com' && path.length > 2) {
        var repo = path[1] + '/' + path[2];
        fetchForksOfRepo(repo, sortBy);
      }
    });
  }


  function fetchForksOfRepo(repo, sortBy) {
    // Show the loader
    chrome.runtime.sendMessage({action: "getForks", repo: repo, page: currentPage, sortBy: sortBy}, function(response) {
        // Hide the loader
        document.getElementById('loader').style.display = 'none';
    
        if (response.error) {
            console.error('Error from background: ', response.error);
            return;
        }
    
        if (!response.forks) {
            console.error('Unexpected response: ', response);
            return;
        }
    
        displayForks(response.forks);
        document.getElementById('next-page').disabled = !response.hasNextPage;

    });
}

function displayForks(forks) {
    let forksElement = document.getElementById('forks');
    document.getElementById('fork-table').style.display = 'inline-block';
    document.getElementById('searchSection').style.display = 'inline-block';

    // clear existing rows
    while (forksElement.rows.length > 1) {
        forksElement.deleteRow(1);
    }
  
    forks.forEach(createRow);
  
}

function createRow(fork) {
    let tr = document.createElement('tr');

    let tdName = document.createElement('td');
    let aName = document.createElement('a');
    aName.textContent = fork.full_name;
    aName.href = 'https://github.com/' + fork.full_name;
    aName.target = "_blank";
    tdName.appendChild(aName);

    let tdCommitSummary = document.createElement('td');
    tdCommitSummary.textContent = fork.commit_summary;

    let tdDateCreated = document.createElement('td');
    tdDateCreated.textContent = new Date(fork.created_at).toLocaleDateString();

    let tdLastCommit = document.createElement('td');
    if (fork.last_commit !== 'N/A') {
        tdLastCommit.textContent = new Date(fork.last_commit).toLocaleDateString();
    } else {
        tdLastCommit.textContent = 'No Commits';
    }

    let tdStars = document.createElement('td');
    tdStars.textContent = fork.stargazers_count;

    let tdAheadBy = document.createElement('td');
    let tdBehindBy = document.createElement('td');

    tdAheadBy.textContent = fork.ahead_by;
    tdBehindBy.textContent = fork.behind_by;

    tr.appendChild(tdName);
    tr.appendChild(tdCommitSummary);
    tr.appendChild(tdDateCreated);
    tr.appendChild(tdLastCommit);
    tr.appendChild(tdStars);
    tr.appendChild(tdAheadBy);
    tr.appendChild(tdBehindBy);

    document.getElementById('forks').appendChild(tr);
}


  
  