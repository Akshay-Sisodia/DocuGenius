import streamlit as st
import requests
import os
import json
import tempfile
from typing import Dict, Any, Optional

# Configuration
API_URL = os.environ.get("API_URL", "http://localhost:3000/api")

# Set up page
st.set_page_config(page_title="DocuGenius UI", layout="wide")

st.title("📝 DocuGenius - AI Documentation Generator")
st.caption("Generate comprehensive documentation from GitHub repositories or code snippets")

# Create tabs for different input methods
tab1, tab2 = st.tabs(["GitHub Repository", "Code Snippet"])

# GitHub Repository tab
with tab1:
    st.subheader("Generate from GitHub Repository")
    repo_url = st.text_input("GitHub Repository URL:", placeholder="https://github.com/user/repo")
    
    if st.button("Generate Documentation", key="btn_github", type="primary"):
        if not repo_url:
            st.warning("Please enter a GitHub repository URL.")
        else:
            with st.spinner("Cloning repository and generating documentation... This may take a few minutes."):
                try:
                    # Call the API to process the repository
                    response = requests.post(
                        f"{API_URL}/process", 
                        json={"repoUrl": repo_url},
                        timeout=600
                    )
                    response.raise_for_status()
                    
                    result = response.json()
                    
                    if result.get("success"):
                        documentation = result.get("documentation", "No documentation generated.")
                        repo_id = result.get("repoId", "unknown_repo")
                        
                        st.success("Documentation generated successfully!")
                        
                        # Display markdown
                        st.markdown(documentation)
                        
                        # Download button
                        st.download_button(
                            label="📥 Download Documentation (Markdown)",
                            data=documentation,
                            file_name=f"{repo_id}_documentation.md",
                            mime="text/markdown",
                        )
                    else:
                        st.error(f"Error: {result.get('error', 'Unknown error')}")
                        
                except requests.RequestException as e:
                    st.error(f"API Error: {str(e)}")
                except Exception as e:
                    st.error(f"Error: {str(e)}")

# Code Snippet tab
with tab2:
    st.subheader("Generate from Code Snippet")
    code = st.text_area("Paste your code:", height=250, placeholder="// Paste your code here")
    
    col1, col2 = st.columns(2)
    with col1:
        language = st.selectbox(
            "Language",
            options=["JavaScript", "TypeScript", "Python", "Java", "C++", "Go", "Ruby", "PHP", 
                     "HTML", "CSS", "Shell", "JSON", "Markdown"]
        )
    with col2:
        path = st.text_input("File path (optional):", placeholder="example.js")
    
    if st.button("Generate Documentation", key="btn_code", type="primary"):
        if not code:
            st.warning("Please paste some code to document.")
        else:
            with st.spinner("Generating documentation..."):
                try:
                    # Call the API to process the code
                    response = requests.post(
                        f"{API_URL}/process-code", 
                        json={
                            "code": code,
                            "language": language.lower(),
                            "path": path if path else f"snippet.{language.lower()}"
                        },
                        timeout=300
                    )
                    response.raise_for_status()
                    
                    result = response.json()
                    
                    if result.get("success"):
                        documentation = result.get("documentation", "No documentation generated.")
                        
                        st.success("Documentation generated successfully!")
                        
                        # Display markdown
                        st.markdown(documentation)
                        
                        # Download button
                        st.download_button(
                            label="📥 Download Documentation (Markdown)",
                            data=documentation,
                            file_name=f"code_documentation.md",
                            mime="text/markdown",
                        )
                    else:
                        st.error(f"Error: {result.get('error', 'Unknown error')}")
                        
                except requests.RequestException as e:
                    st.error(f"API Error: {str(e)}")
                except Exception as e:
                    st.error(f"Error: {str(e)}")

# Sidebar settings
with st.sidebar:
    st.header("Settings")
    api_url = st.text_input("API URL:", value=API_URL)
    if api_url != API_URL:
        API_URL = api_url
        st.success(f"Using API URL: {API_URL}")
    
    # Add health check
    try:
        health_response = requests.get(f"{API_URL}/health", timeout=5)
        if health_response.status_code == 200:
            st.success("✅ API Server is running")
        else:
            st.error("❌ API Server error")
    except:
        st.error("❌ API Server not reachable")
    
    st.markdown("---")
    st.markdown("""
    ### About DocuGenius
    
    DocuGenius uses advanced AI to generate comprehensive documentation from your code.
    
    - Process entire GitHub repositories
    - Document individual code snippets
    - Generate markdown documentation
    """) 