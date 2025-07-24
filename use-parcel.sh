#!/bin/bash
# Switch to Parcel mode

echo "Switching to Parcel configuration..."

# Backup current package.json
cp package.json package.remix.json

# Use Parcel package.json
cp package.parcel.json package.json

echo "Done! Now you can run:"
echo "  npm install"
echo "  npm start"
echo ""
echo "To switch back to Remix, run: ./use-remix.sh"