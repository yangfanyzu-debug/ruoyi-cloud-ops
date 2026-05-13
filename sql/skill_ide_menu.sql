-- Skill IDE 菜单接入脚本
-- 建议在 ry-cloud 库中执行

SET @skill_ide_menu_path = 'http://192.168.0.140/skill-ide/';
SET @skill_ide_menu_name = 'Skill IDE';

INSERT INTO sys_menu (
  menu_name,
  parent_id,
  order_num,
  path,
  component,
  query,
  route_name,
  is_frame,
  is_cache,
  menu_type,
  visible,
  status,
  perms,
  icon,
  create_by,
  create_time,
  update_by,
  update_time,
  remark
)
SELECT
  @skill_ide_menu_name,
  0,
  90,
  @skill_ide_menu_path,
  NULL,
  '',
  'SkillIDE',
  0,
  1,
  'C',
  '0',
  '0',
  '',
  'guide',
  'admin',
  SYSDATE(),
  '',
  NULL,
  'Skill IDE 外链菜单'
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE path = @skill_ide_menu_path
);

SET @skill_ide_menu_id = (
  SELECT menu_id
  FROM sys_menu
  WHERE path = @skill_ide_menu_path
  LIMIT 1
);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT role_id, @skill_ide_menu_id
FROM sys_role
WHERE status = '0';
