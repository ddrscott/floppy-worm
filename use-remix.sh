#!/bin/bash
# Switch to Remix mode

echo "Switching to Remix configuration..."

# Restore Remix package.json
if [ -f "package.remix.json" ]; then
    cp package.remix.json package.json
    echo "Done! Now you can run:"
    echo "  npm install"
    echo "  npm run editor"
else
    echo "No backup found. Please manually restore package.json"
fi