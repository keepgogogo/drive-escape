# 周末自驾逃离计划 - VPS 部署指南

## 环境要求

- Node.js >= 18.0.0（支持 ESM 和原生 fetch）
- npm >= 9.0.0（随 Node.js 一起安装）
- 硬盘空间 >= 500MB（数据约 250MB）
- 内存 >= 512MB

**推荐版本：**
- Node.js 20.x LTS（长期支持版本，推荐生产环境使用）
- Node.js 22.x LTS（最新 LTS 版本）

## 安装 Node.js 和 npm

### 方式一：使用 nvm 安装（推荐）

nvm（Node Version Manager）可以方便地管理和切换 Node.js 版本。

```bash
# 1. 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 2. 重新加载 shell 配置
source ~/.bashrc
# 或如果使用 zsh
source ~/.zshrc

# 3. 安装 Node.js 20.x LTS
nvm install 20

# 4. 设置默认版本
nvm alias default 20

# 5. 验证安装
node --version   # 应显示 v20.x.x
npm --version    # 应显示 10.x.x
```

### 方式二：使用 NodeSource 仓库（Ubuntu/Debian）

适合不想使用 nvm 的用户，直接通过 apt 安装。

```bash
# 1. 更新系统包
sudo apt update

# 2. 安装 Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 验证安装
node --version   # 应显示 v20.x.x
npm --version    # 应显示 10.x.x
```

### 方式三：使用 NodeSource 仓库（CentOS/RHEL/Fedora）

```bash
# 1. 安装 Node.js 20.x LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 或使用 dnf（Fedora）
sudo dnf install -y nodejs

# 2. 验证安装
node --version
npm --version
```

### 方式四：使用系统包管理器（不推荐）

系统自带的 Node.js 版本通常较旧，可能不满足要求。

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# CentOS/RHEL
sudo yum install nodejs npm

# 验证版本（可能低于 18.x）
node --version
```

如果版本过低，请使用上述方式一或方式二重新安装。

### 验证安装成功

```bash
# 检查 Node.js 版本（需要 >= 18.0.0）
node --version

# 检查 npm 版本
npm --version

# 测试 Node.js 是否正常工作
node -e "console.log('Node.js 安装成功！')"
```

## 快速开始

### 1. 安装依赖

```bash
# 克隆项目
git clone <your-repo-url>
cd drive-escape

# 无需 npm install，项目使用 Node.js 原生模块
```

### 2. 下载数据

```bash
# 下载全国行政区划数据（首次运行必须）
npm run download

# 预计耗时：10-30 分钟（取决于网络速度）
# 数据量：约 250MB，3400+ 个文件
```

### 3. 启动服务

```bash
# 开发模式
npm start

# 生产模式（指定端口）
PORT=8080 npm start
```

访问 `http://localhost:3000` 即可使用。

## 生产部署

### 方式一：systemd 服务（推荐）

创建服务文件 `/etc/systemd/system/drive-escape.service`：

```ini
[Unit]
Description=Drive Escape - 周末自驾逃离计划
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/drive-escape
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable drive-escape
sudo systemctl start drive-escape
sudo systemctl status drive-escape
```

### 方式二：PM2 进程管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name drive-escape

# 设置开机自启
pm2 startup
pm2 save
```

### 方式三：Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

构建并运行：

```bash
docker build -t drive-escape .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data drive-escape
```

## Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 数据维护

### 定期更新数据

建议每月更新一次行政区划数据：

```bash
# 手动更新
npm run update

# 或设置定时任务（crontab）
# 每月1日凌晨3点更新
0 3 1 * * cd /var/www/drive-escape && npm run update >> /var/log/drive-escape-update.log 2>&1
```

### 数据目录结构

```
data/geo/
├── 110000.json    # 北京市
├── 110100.json    # 北京市市辖区
├── 110101.json    # 东城区
├── 110102.json    # 西城区
├── ...
└── 820000.json    # 澳门特别行政区
```

## 故障排查

### 问题：数据下载失败

```bash
# 检查网络连接
curl -I https://geo.datav.aliyun.com/areas_v3/bound/420000_full.json

# 重新下载（支持断点续传）
npm run download
```

### 问题：服务启动失败

```bash
# 检查端口占用
lsof -i :3000

# 检查 Node.js 版本
node --version  # 需要 >= 18.0.0
```

### 问题：地图加载缓慢

```bash
# 检查数据文件是否存在
ls -la data/geo/ | wc -l  # 应该有 3400+ 个文件

# 检查磁盘空间
df -h
```

## 性能优化

### 启用 Gzip 压缩（Nginx）

```nginx
gzip on;
gzip_types application/json;
gzip_min_length 1000;
```

### 启用浏览器缓存

服务已设置 `Cache-Control: public, max-age=86400`，浏览器会缓存 24 小时。

## 安全建议

1. 使用 Nginx 作为反向代理，不直接暴露 Node.js 端口
2. 配置 HTTPS（Let's Encrypt 免费证书）
3. 限制 `/api/geo` 接口的请求频率（防止滥用）

```nginx
# 限流配置
limit_req_zone $binary_remote_addr zone=geo_limit:10m rate=10r/s;

location /api/geo {
    limit_req zone=geo_limit burst=20 nodelay;
    proxy_pass http://127.0.0.1:3000;
}
```
