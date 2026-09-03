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

# 重启服务（进程名是 memory，不是 whisper！）
ssh ubuntu@101.32.214.236 "pm2 restart memory"
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

---

## 当前开发分支

> **每次新会话开始时，先读这个文件确认当前分支！**

- **当前分支**: `ccr-9f12be88-ena119`
- **最后更新**: 2026-09-03
- **状态**: Agent 模式上下文分层 + 工具动态注入 + 贴纸迁移（已完成，已修复语法错误）

---

## Claude 开发纪律（写给自己的规则）

### 必须做

1. **改完代码第一件事：`node --check server.js`** — 语法不过不许提交
2. **提交前检查引号** — `od -c` 检查关键行，确认没有中文引号 `""` 出现在 JS 语法位置
3. **给 Iris 部署指令时** — 直接给完整命令，替换好分支名，不要让她填任何东西
4. **改了哪些文件就拉哪些** — server.js 拉香港，relay 拉 US，前端拉香港，不要漏
5. **重要信息写到仓库文件** — 服务器路径、分支名、架构信息等，不要靠记忆

### 绝对不能做

1. **不要用 Edit 工具写含中文的长字符串** — Edit 会把直引号 `""` 转成中文引号 `""`，导致语法错误。用 `cat heredoc` 或 `sed` 代替
2. **不要在没验证语法的情况下让 Iris 部署**
3. **不要让 Iris 填路径、填参数、填任何技术细节** — 她是用户不是运维
4. **不要浪费额度在可以避免的低级错误上**

### Edit 工具的已知 bug

**问题**: 当 `new_string` 包含中文文本时，Edit 工具会将 ASCII 双引号 `"` 替换为 Unicode 左右双引号 `""`（U+201C/U+201D），导致 JavaScript 语法错误。

**解决方案**: 对包含中文的代码块，使用以下方法之一：
- `cat << 'EOF' > file` heredoc 写入
- `sed` 替换
- 先写入临时文件再 `cp` 覆盖
- 如果必须用 Edit，之后立即 `node --check` 并用 `od -c` 验证引号
