-- Agent 管理菜单接入脚本
-- 在 RuoYi `ry-cloud` 数据库执行。脚本会创建一个目录和 4 个子菜单，并授权给所有正常角色。

SET @agent_mgmt_parent_name = 'Agent管理';
SET @agent_mgmt_parent_path = 'agent-mgmt';

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  @agent_mgmt_parent_name, 0, 80, @agent_mgmt_parent_path, NULL, '', 'AgentMgmt',
  1, 0, 'M', '0', '0', '', 'nested',
  'admin', SYSDATE(), '', NULL, 'Agent 管理目录'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = 0 AND path = @agent_mgmt_parent_path
);

SET @agent_mgmt_parent_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = 0 AND path = @agent_mgmt_parent_path
  LIMIT 1
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT 'Agent', @agent_mgmt_parent_id, 1, 'agents', 'agentMgmt/agents/index', '', 'AgentMgmtAgents',
       1, 0, 'C', '0', '0', 'agent:agents:list', 'peoples',
       'admin', SYSDATE(), '', NULL, 'Agent 管理菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = @agent_mgmt_parent_id AND path = 'agents'
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT '场景', @agent_mgmt_parent_id, 2, 'scenarios', 'agentMgmt/scenarios/index', '', 'AgentMgmtScenarios',
       1, 0, 'C', '0', '0', 'agent:scenarios:list', 'tree',
       'admin', SYSDATE(), '', NULL, '场景管理菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = @agent_mgmt_parent_id AND path = 'scenarios'
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT '运营首页', @agent_mgmt_parent_id, 3, 'overview', 'agentMgmt/overview/index', '', 'AgentMgmtOverview',
       1, 0, 'C', '0', '0', 'agent:overview:list', 'dashboard',
       'admin', SYSDATE(), '', NULL, 'Agent 运营首页菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = @agent_mgmt_parent_id AND path = 'overview'
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT '执行日志', @agent_mgmt_parent_id, 4, 'logs', 'agentMgmt/logs/index', '', 'AgentMgmtLogs',
       1, 0, 'C', '0', '0', 'agent:logs:list', 'log',
       'admin', SYSDATE(), '', NULL, 'Agent 执行日志菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = @agent_mgmt_parent_id AND path = 'logs'
);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r
JOIN sys_menu m ON m.path IN ('agent-mgmt', 'agents', 'scenarios', 'overview', 'logs')
WHERE r.status = '0'
  AND (m.menu_id = @agent_mgmt_parent_id OR m.parent_id = @agent_mgmt_parent_id);
