# Setting Up Cursor with DocuGenius MCP

This guide explains how to set up the [Cursor](https://cursor.sh/) editor to work with DocuGenius's MCP server for documentation generation.

## Prerequisites

1. Install [Cursor](https://cursor.sh/)
2. Set up DocuGenius according to the main README
3. Obtain an OpenRouter API key

## Configuration

### Step 1: Create `.cursor/mcp.json`

In your project directory, create a `.cursor` folder if it doesn't exist, and create an `mcp.json` file inside it:

```bash
mkdir -p .cursor
touch .cursor/mcp.json
```

### Step 2: Configure MCP in Cursor

Edit the `.cursor/mcp.json` file with the following content:

```json
{
  "mcpServers": {
    "docugenius": {
      "autoApprove": [],
      "disabled": false,
      "timeout": 300,
      "command": "node",
      "args": [
        "<ABSOLUTE_PATH_TO_PROJECT>/src/server/mcp-server.js"
      ],
      "env": {
        "OPENROUTER_API_KEY": "your_openrouter_api_key_here",
        "OPENROUTER_MODEL": "nvidia/llama-3.1-nemotron-nano-8b-v1:free"
      },
      "transportType": "stdio"
    }
  }
}
```

Replace `<ABSOLUTE_PATH_TO_PROJECT>` with the absolute path to your DocuGenius project folder.

### Step 3: Add Your API Key

Replace `your_openrouter_api_key_here` with your actual OpenRouter API key.

## Using DocuGenius in Cursor

Once configured, you can use DocuGenius commands directly from Cursor:

1. Open a file in Cursor
2. Use Command Palette (Ctrl+Shift+P or Cmd+Shift+P on Mac)
3. Type "DocuGenius" to see available commands
4. Choose "Generate Documentation for Current File" to document the current file

## Troubleshooting

### Common Issues

1. **MCP Server Not Found**: Make sure the path in the `args` array is correct and points to the `mcp-server.js` file.

2. **API Key Issues**: If you encounter errors about invalid API responses, check:
   - Verify your API key is correct
   - Check for rate limits in the OpenRouter dashboard
   - Try a different model by changing `OPENROUTER_MODEL`

3. **Missing Dependencies**: Ensure you've installed all project dependencies with `npm install`

### Checking Logs

If you encounter issues, check the Cursor logs:

1. From Command Palette, open "View Logs"
2. Look for entries related to "docugenius" MCP server

## Updating

When updating DocuGenius, remember to update your `.cursor/mcp.json` file if there are changes to the MCP server configuration. 