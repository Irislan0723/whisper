# 部署指南

> **给 Claude 看的备忘录** — 每次部署前先读这个文件，别再忘了。

---

## 服务器架构

| 角色 | IP | 用户 | 位置 |
|------|------|------|------|
| US VPS — CC Relay | 45.32.68.56 | root | /opt/cc-relay/ |
| 香港服务器 — Whisper 主服务 | 101.32.214.236 | ubuntu | /home/ubuntu/memory-service/ |

---

## 文件 → 服务器对应关系

| 文件 | 部署到 | 说明 |
|------|--------|------|
| `server.js` | 香港服务器 | Whisper 后端主文件 |
| `relay-tmux.js` | US VPS | CC Agent 模式中继（tmux 版） |
| `relay-v3.js` | US VPS | CC Agent 模式中继（旧版 -p pipe） |
| `public/*` 前端文件 | 香港服务器 | 前端页面/JS/CSS |

---

## 部署指令

### 变量说明

所有命令中的 `<branch>` 替换为当前开发分支名。

---

### 香港服务器（server.js / 前端）

香港服务器有 git 仓库克隆，用 `git fetch + checkout` 拉取：

```bash
# 拉 server.js
ssh ubuntu@101.32.214.236 "cd /home/ubuntu/memory-service && git fetch origin <branch> && git checkout origin/<branch> -- server.js"

# 拉前端文件（示例，按实际改过的文件名替换）
ssh ubuntu@101.32.214.236 "cd /home/ubuntu/memory-service && git fetch origin <branch> && git checkout origin/<branch> -- public/chat-app-xxx.js"

# 重启服务
ssh ubuntu@101.32.214.236 "pm2 restart all"
```

---

### US VPS（relay 文件）

US VPS 的 `/opt/cc-relay/` **不是 git 仓库**，用 curl 从 GitHub 下载：

```bash
# 拉 relay-tmux.js + 重启服务
ssh root@45.32.68.56 "cd /opt/cc-relay && curl -o relay-tmux.js https://raw.githubusercontent.com/Irislan0723/whisper/<branch>/relay-tmux.js && systemctl restart cc-relay"
```

---

### 查看日志

```bash
# US VPS — CC Relay 日志
ssh root@45.32.68.56 "journalctl -u cc-relay -f --no-pager"

# 香港服务器 — Whisper 日志
ssh ubuntu@101.32.214.236 "pm2 logs"
```

---

## US VPS systemd 服务配置

文件路径：`/etc/systemd/system/cc-relay.service`

```ini
[Unit]
Description=CC Relay (tmux)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/cc-relay
ExecStart=/usr/bin/node relay-tmux.js
Restart=always
RestartSec=5
KillMode=process
Environment=RELAY_TOKEN=<token>
Environment=RELAY_PORT=3001

[Install]
WantedBy=multi-user.target
```

更新服务配置后：
```bash
ssh root@45.32.68.56 "systemctl daemon-reload && systemctl restart cc-relay"
```

---

## 注意事项

- 仓库是 **私有** 的，curl 下载如果失败可能需要 token
- US VPS 上启动成功会看到 `CC Relay (tmux) v1 on :3001`
- 改了前端文件记得同时给香港服务器拉
- **每次给 Iris 部署指令时，直接给完整的可复制粘贴命令，不要让她填路径**
