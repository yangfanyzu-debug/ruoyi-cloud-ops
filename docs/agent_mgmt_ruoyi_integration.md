# Agent 管理接入 RuoYi 部署说明

## 数据库

1. 在 `ry-cloud` 库执行 `E:\agent-mgmt-service\migrations\001_create_agent_mgmt_tables.sql`。
2. 在 `ry-cloud` 库执行 `E:\RuoYi-Cloud-master\sql\agent_mgmt_menu.sql`。

Agent 管理表不使用外键，兼容 MySQL 5.7。资源名称继续全局唯一。

## Gateway

在 Nacos 的 `ruoyi-gateway-dev.yml` 增加路由：

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: agent-mgmt-api
          uri: http://127.0.0.1:8300
          predicates:
            - Path=/agent-mgmt-api/**
          filters:
            - StripPrefix=1
```

前端生产环境仍通过 `/prod-api/agent-mgmt-api/**` 访问，Nginx 先转发到 RuoYi Gateway，Gateway 再转发到 FastAPI 服务。

## 后端服务

后端部署到 `192.168.0.142`：

```bash
cd /opt/agent-mgmt-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export AGENT_MGMT_DB_HOST=192.168.0.140
export AGENT_MGMT_DB_NAME=ry-cloud
export AGENT_MGMT_DB_USER=root
export AGENT_MGMT_DB_PASSWORD='******'
nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8300 > agent-mgmt.log 2>&1 &
```

健康检查：

```bash
curl http://127.0.0.1:8300/health
curl http://127.0.0.1:8080/agent-mgmt-api/health
```
