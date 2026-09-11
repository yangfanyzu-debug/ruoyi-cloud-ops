-- 报告管理菜单接入脚本
-- 在 RuoYi `ry-cloud` 数据库执行。脚本会创建报告中心目录、报告管理和AI审核配置菜单，并授权给所有正常角色。

SET NAMES utf8mb4;

SET @report_parent_path = 'report-management';

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  '报告中心', 0, 75, @report_parent_path, 'Layout', '', 'ReportManagement',
  1, 0, 'M', '0', '0', '', 'documentation',
  'admin', SYSDATE(), '', NULL, '报告中心目录'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = 0 AND path = @report_parent_path
);

SET @report_parent_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = 0 AND path = @report_parent_path
  LIMIT 1
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  '报告管理', @report_parent_id, 1, 'reports', 'report-management/report/index', '', 'ReportManagementList',
  1, 0, 'C', '0', '0', 'report:management:list', 'documentation',
  'admin', SYSDATE(), '', NULL, '报告管理菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = @report_parent_id AND path = 'reports'
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  'AI审核配置', @report_parent_id, 2, 'audit-prompts', 'report-management/audit-prompt/index', '', 'ReportAuditPrompt',
  1, 0, 'C', '0', '0', 'report:prompt:list', 'edit',
  'admin', SYSDATE(), '', NULL, 'AI审核配置菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = @report_parent_id AND path = 'audit-prompts'
);

UPDATE sys_menu
SET menu_name = 'AI审核配置', remark = 'AI审核配置菜单', update_by = 'admin', update_time = SYSDATE()
WHERE parent_id = @report_parent_id AND path = 'audit-prompts';

SET @report_list_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = @report_parent_id AND path = 'reports'
  LIMIT 1
);

SET @report_prompt_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = @report_parent_id AND path = 'audit-prompts'
  LIMIT 1
);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r
JOIN sys_menu m ON m.menu_id IN (@report_parent_id, @report_list_id, @report_prompt_id)
WHERE r.status = '0';
