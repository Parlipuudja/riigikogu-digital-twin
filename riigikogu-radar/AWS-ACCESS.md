# AWS Access Guide - Riigikogu Radar

## Quick Connect

```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135
```

## Server Details

| Property | Value |
|----------|-------|
| **IP Address** | 13.63.58.135 |
| **DNS** | ec2-13-63-58-135.eu-north-1.compute.amazonaws.com |
| **Region** | eu-north-1 (Stockholm) |
| **Instance** | t3.small |
| **User** | ubuntu |
| **Key file** | `~/.ssh/riigikogu-radar.pem` |

## Setup on a New Device

### 1. Copy the SSH Key

The private key is stored at `~/.ssh/riigikogu-radar.pem` on your main machine.

Copy it to your new device:
```bash
# On new device, create the key file:
mkdir -p ~/.ssh
nano ~/.ssh/riigikogu-radar.pem
# Paste the key content, save

# Set permissions:
chmod 600 ~/.ssh/riigikogu-radar.pem
```

### 2. Add Shell Alias (Optional)

```bash
echo 'alias rk="ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135"' >> ~/.bashrc
source ~/.bashrc
```

Now just type `rk` to connect.

## Common Commands

### Connect
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135
```

### Run Claude Code
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135 \
  "cd riigikogu-radar/riigikogu-radar && claude"
```

### Check Backtest Progress
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135 \
  "tail -20 ~/logs/backtest.log"
```

### Check Sync Logs
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135 \
  "tail -50 ~/logs/sync.log"
```

### Run Manual Sync
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135 \
  "cd riigikogu-radar/riigikogu-radar && npx tsx scripts/sync-api.ts all"
```

### Check Database Stats
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135 \
  "cd riigikogu-radar/riigikogu-radar && npx tsx scripts/db-stats.ts"
```

### Pull Latest Code
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135 \
  "cd riigikogu-radar/riigikogu-radar && git pull"
```

## Scheduled Jobs (Cron)

| Job | Schedule | Log |
|-----|----------|-----|
| Data sync | Daily 5:00 UTC | `~/logs/sync.log` |
| Embeddings | Daily 5:30 UTC | `~/logs/embeddings.log` |
| Backtest | Sunday 6:00 UTC | `~/logs/backtest.log` |

View cron jobs:
```bash
ssh -i ~/.ssh/riigikogu-radar.pem ubuntu@13.63.58.135 "crontab -l"
```

## Project Location

```
/home/ubuntu/riigikogu-radar/riigikogu-radar/
├── .env                 # Environment variables
├── scripts/             # Sync, backtest, embeddings
├── src/                 # Application code
└── ...
```

## Troubleshooting

### Permission denied (publickey)
```bash
chmod 600 ~/.ssh/riigikogu-radar.pem
```

### Connection timeout
- Check if instance is running: AWS Console → EC2 → Instances
- Security group allows port 22 from your IP

### Start/Stop Instance (AWS CLI)
```bash
# Stop (save money when not using)
aws ec2 stop-instances --instance-ids i-0aff64fcc8c5b93bf --region eu-north-1

# Start
aws ec2 start-instances --instance-ids i-0aff64fcc8c5b93bf --region eu-north-1
```

## Costs

- **Running**: ~$0.02/hour ($15/month if 24/7)
- **Stopped**: ~$0.50/month (EBS storage only)

**Tip**: Stop the instance when not in use to save costs.

---

*Instance ID: i-0aff64fcc8c5b93bf*
*Created: 2026-02-02*
