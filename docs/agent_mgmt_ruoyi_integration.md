# Agent 管理接入 RuoYi 部署说明

## 数据库

1. 在 `ry-cloud` 库执行 `E:\agent-mgmt-service\migrations\001_create_agent_mgmt_tables.sql`。
2. 在 `ry-cloud` 库执行 `E:\RuoYi-Cloud-master\sql\agent_mgmt_menu.sql`。

Agent 管理表不使用外键，兼容 MySQL 5.7。资源名称继续全局唯一。

## Gateway

在 Nacos 的 `ruoyi-gateway-dev.yml` 配置统一 AISRE 后端路由。Agent 管理和 Skill IDE
都由端口 `5000` 上的同一个 FastAPI 进程提供：

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: agent-mgmt-api
          uri: http://127.0.0.1:5000
          predicates:
            - Path=/agent-mgmt-api/**
          filters:
            - StripPrefix=1
```

前端生产环境仍通过 `/prod-api/agent-mgmt-api/**` 访问，Nginx 先转发到 RuoYi Gateway，Gateway 再转发到统一 AISRE FastAPI 服务。

## 后端服务

后端随 AISRE 部署并由 `skill-ide.service` 管理：

```bash
systemctl status skill-ide.service
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/ready
```

健康检查：

```bash
curl http://127.0.0.1:8080/agent-mgmt-api/health
```
