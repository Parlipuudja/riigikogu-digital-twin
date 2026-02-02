# AWS Deployment

One-click deployment of Riigikogu Radar to AWS EC2.

## Quick Start

### Option 1: AWS Console (Easiest)

1. Go to [CloudFormation Console](https://console.aws.amazon.com/cloudformation)
2. Click "Create stack" → "With new resources"
3. Upload `cloudformation.yaml`
4. Fill in parameters:
   - **KeyName**: Your EC2 key pair name
   - **MongoDBUri**: Your MongoDB Atlas connection string
   - **AnthropicApiKey**: Your Anthropic API key
   - **VoyageApiKey**: Your Voyage AI API key
5. Click through and create stack
6. Wait ~5 minutes for setup to complete
7. Access app at the URL in Outputs tab

### Option 2: AWS CLI

```bash
aws cloudformation create-stack \
  --stack-name riigikogu-radar \
  --template-body file://cloudformation.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=your-key-name \
    ParameterKey=MongoDBUri,ParameterValue='mongodb+srv://...' \
    ParameterKey=AnthropicApiKey,ParameterValue='sk-ant-...' \
    ParameterKey=VoyageApiKey,ParameterValue='pa-...' \
  --capabilities CAPABILITY_IAM \
  --region eu-north-1
```

## What Gets Created

- **EC2 Instance** (t3.small by default, ~$15/month)
- **Security Group** (SSH + port 3000)
- **IAM Role** (for SSM access)
- **Systemd Services**:
  - `riigikogu-radar.service` - Next.js app (auto-starts)
  - `riigikogu-sync.timer` - Daily data sync at 5am UTC

## Post-Deployment

### SSH Access
```bash
ssh -i your-key.pem ubuntu@<instance-ip>
```

### View Logs
```bash
# App logs
sudo journalctl -u riigikogu-radar -f

# Sync logs
sudo journalctl -u riigikogu-sync -f

# Setup logs
cat /var/log/user-data.log
```

### Manual Operations
```bash
cd /home/riigikogu/riigikogu-radar

# Run sync manually
sudo -u riigikogu npx tsx scripts/sync-api.ts all

# Run backtest
sudo -u riigikogu npx tsx scripts/run-backtest.ts

# Generate embeddings
sudo -u riigikogu npx tsx scripts/generate-embeddings.ts
```

### Run Claude Code
```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Run it
cd /home/riigikogu/riigikogu-radar
claude
```

## Cost Optimization

- **Stop when not using**: EC2 charges by hour
- **Use Spot instances**: Add `SpotPrice: "0.01"` for ~70% savings
- **Schedule shutdown**: Use EventBridge to stop at night

## Cleanup

```bash
aws cloudformation delete-stack --stack-name riigikogu-radar
```
