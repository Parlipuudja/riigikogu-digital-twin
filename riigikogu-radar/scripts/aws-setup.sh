#!/bin/bash
# AWS EC2 Setup Script for Riigikogu Radar
# Run this on a fresh Ubuntu 22.04/24.04 EC2 instance
#
# Recommended instance: t3.small ($0.02/hr) or t3.medium ($0.04/hr)
# Storage: 20GB gp3
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/aws-setup.sh | bash
#   OR
#   bash aws-setup.sh

set -e

echo "=== Riigikogu Radar AWS Setup ==="

# Update system
echo "Updating system..."
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install git
echo "Installing git..."
sudo apt-get install -y git

# Install build essentials (for native modules)
sudo apt-get install -y build-essential

# Clone repository (if not already present)
if [ ! -d "riigikogu-radar" ]; then
    echo "Cloning repository..."
    git clone https://github.com/YOUR_USERNAME/riigikogu-radar.git
fi

cd riigikogu-radar

# Install dependencies
echo "Installing npm dependencies..."
npm ci

# Create .env template if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env template..."
    cat > .env << 'EOF'
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://...

# Anthropic API key for Claude
ANTHROPIC_API_KEY=sk-ant-...

# Voyage AI key for embeddings
VOYAGE_API_KEY=pa-...
EOF
    echo "IMPORTANT: Edit .env with your actual credentials"
fi

# Install Claude Code CLI (optional but recommended)
echo "Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code || true

# Create systemd service for background tasks (optional)
echo "Creating systemd service template..."
sudo tee /etc/systemd/system/riigikogu-sync.service > /dev/null << 'EOF'
[Unit]
Description=Riigikogu Radar Daily Sync
After=network.target

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/home/ubuntu/riigikogu-radar
ExecStart=/usr/bin/npx tsx scripts/sync-api.ts all
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/riigikogu-sync.timer > /dev/null << 'EOF'
[Unit]
Description=Run Riigikogu sync daily at 5am UTC

[Timer]
OnCalendar=*-*-* 05:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit .env with your credentials:"
echo "   nano .env"
echo ""
echo "2. Test the setup:"
echo "   npm run dev"
echo ""
echo "3. Run sync manually:"
echo "   npx tsx scripts/sync-api.ts status"
echo ""
echo "4. (Optional) Enable daily sync timer:"
echo "   sudo systemctl enable --now riigikogu-sync.timer"
echo ""
echo "5. (Optional) Run Claude Code:"
echo "   claude"
echo ""
