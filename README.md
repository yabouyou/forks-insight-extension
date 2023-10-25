
# Forks Insight Chrome Extension

This project is involved with displaying AI summaries as well as other relevant information about the forks of a github repository. In addition, there is a Q&A feature that allows you to ask questions about the changes in a fork.  

https://github.com/FORCOLAB-UofT/forks-insight-chrome/assets/33936354/274ccabb-08af-4c2c-8822-00f4efd04fa8

## Setup

First you will need to create a tokens.json file which will contain the API keys for all the APIs used in this project. Please ensure you are using tokens.json in combination and place it in your .gitignore file so that you do not accidentally publish a secret key.  

Here's the format of tokens.json: 

```
{
  "GITHUB": <GITHUB API TOKEN>, 
  "OPENAI": "<OPENAI TOKEN>",
  "PINECONE-TOKEN": "<YOUR PINECONE TOKEN>",
  "PINECONE-URL": "https://<YOUR PINECONE ENVIRONMENT>.pinecone.io"
}
```

For obtaining API keys please visit:
- Github: https://github.com/settings/tokens
- OpenAI: https://platform.openai.com/account/api-keys
- Pinecone environment & Token: https://docs.pinecone.io/docs/quickstart


Once you have setup your `tokens.json` file, download or clone the repository and place it in the root folder. In order to install the extension onto chrome follow these steps:

1. Navigate to chrome://extensions
2. Enable developer mode in the top right of the page
3. Select Load Unpacked -> Select the location repository folder 
4. The extension should now be available in the top right of chrome


## Usage

- Navigate to any github repository
- Click on the chrome extension in the top right
- This will load a chart filled with AI summaries and other relevant information 
- You can ask any question regarding the changes to the forks displayed using the search tool and it will generate an AI response. 

<img width="1728" alt="example1" src="https://github.com/FORCOLAB-UofT/forks-insight-chrome/assets/33936354/dcd7f489-b53b-46ca-a909-8a96d6a1b028">

<img width="636" alt="example2" src="https://github.com/FORCOLAB-UofT/forks-insight-chrome/assets/33936354/189b2800-7e63-4e05-8369-88f647bfa832">


## Architecture 

This application uses a pinecone's vector database to do a cosine similarity search to filter the results of the diffs and then passes these diffs to OPENAI's GPT-3.5-turbo model to generate summarize responses and answer questions

<img width="1004" alt="architecture" src="https://github.com/FORCOLAB-UofT/forks-insight-chrome/assets/33936354/d50f1da0-79ea-41ba-a25f-e9e3a2f49752">


