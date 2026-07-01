-- 告警配置中心菜单接入脚本
-- 在 RuoYi `ry-cloud` 数据库执行。脚本会创建配置中心目录、告警匹配规则菜单，并授权给所有正常角色。

SET @alert_config_parent_path = 'config-center';

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  '配置中心', 0, 70, @alert_config_parent_path, NULL, '', 'ConfigCenter',
  1, 0, 'M', '0', '0', '', 'build',
  'admin', SYSDATE(), '', NULL, '配置中心目录'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = 0 AND path = @alert_config_parent_path
);

SET @alert_config_parent_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = 0 AND path = @alert_config_parent_path
  LIMIT 1
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  '告警匹配规则', @alert_config_parent_id, 1, 'alert-rules', 'configCenter/alertRules/index', '', 'AlertMatchingRules',
  1, 0, 'C', '0', '0', 'config:alert-rule:list', 'filter',
  'admin', SYSDATE(), '', NULL, '告警匹配规则菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = @alert_config_parent_id AND path = 'alert-rules'
);

SET @alert_config_child_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = @alert_config_parent_id AND path = 'alert-rules'
  LIMIT 1
);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r
JOIN sys_menu m ON m.menu_id IN (@alert_config_parent_id, @alert_config_child_id)
WHERE r.status = '0';
