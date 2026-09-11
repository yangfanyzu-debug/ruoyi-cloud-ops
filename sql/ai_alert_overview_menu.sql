-- AI 告警处理统计菜单接入脚本
-- 在 RuoYi `ry-cloud` 数据库执行。脚本创建“告警分析”目录和“AI 处理统计”菜单，并授权给所有正常角色。

SET NAMES utf8mb4;

SET @alert_analysis_parent_path = 'alert-analysis';

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  '告警分析', 0, 75, @alert_analysis_parent_path, NULL, '', 'AlertAnalysis',
  1, 0, 'M', '0', '0', '', 'chart',
  'admin', SYSDATE(), '', NULL, '告警统计分析目录'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE parent_id = 0 AND path = @alert_analysis_parent_path
);

SET @alert_analysis_parent_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = 0 AND path = @alert_analysis_parent_path
  LIMIT 1
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  'AI处理统计', @alert_analysis_parent_id, 1, 'ai-overview', 'alertAnalysis/aiOverview/index', '', 'AiAlertOverview',
  1, 0, 'C', '0', '0', 'alert:ai-overview:list', 'dashboard',
  'admin', SYSDATE(), '', NULL, 'AI 告警处理统计菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu
  WHERE parent_id = @alert_analysis_parent_id AND path = 'ai-overview'
);

SET @ai_alert_overview_menu_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = @alert_analysis_parent_id AND path = 'ai-overview'
  LIMIT 1
);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r
JOIN sys_menu m ON m.menu_id IN (@alert_analysis_parent_id, @ai_alert_overview_menu_id)
WHERE r.status = '0';

SET @monthly_report_menu_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = @alert_analysis_parent_id AND path = 'monthly-report'
  LIMIT 1
);

INSERT INTO sys_menu (
  menu_name, parent_id, order_num, path, component, query, route_name,
  is_frame, is_cache, menu_type, visible, status, perms, icon,
  create_by, create_time, update_by, update_time, remark
)
SELECT
  '月度报告统计', @alert_analysis_parent_id, 2, 'monthly-report', 'alertAnalysis/monthlyReport/index', '', 'MonthlyReport',
  1, 0, 'C', '0', '0', 'alert:monthly-report:list', 'date-range',
  'admin', SYSDATE(), '', NULL, '月度报告覆盖统计'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu
  WHERE parent_id = @alert_analysis_parent_id AND path = 'monthly-report'
);

SET @monthly_report_menu_id = (
  SELECT menu_id FROM sys_menu
  WHERE parent_id = @alert_analysis_parent_id AND path = 'monthly-report'
  LIMIT 1
);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r
JOIN sys_menu m ON m.menu_id IN (@monthly_report_menu_id)
WHERE r.status = '0';
