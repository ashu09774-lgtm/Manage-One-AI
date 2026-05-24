SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO users (name, email, avatar_url, status, password_hash)
VALUES
  ('Asha Verma', 'asha@example.com', '/placeholder-user.jpg', 'online', 'taskflowseed0001:733407c27baee3b4a26786dfb75a458c393d1e46072256a12a6f28932e57821cafa6f6f01e446a2412df2e930266fb455cf657740b1510e223ab728415978fff'),
  ('Rohan Mehta', 'rohan@example.com', '/placeholder-user.jpg', 'away', 'taskflowseed0001:733407c27baee3b4a26786dfb75a458c393d1e46072256a12a6f28932e57821cafa6f6f01e446a2412df2e930266fb455cf657740b1510e223ab728415978fff'),
  ('Mira Shah', 'mira@example.com', '/placeholder-user.jpg', 'offline', 'taskflowseed0001:733407c27baee3b4a26786dfb75a458c393d1e46072256a12a6f28932e57821cafa6f6f01e446a2412df2e930266fb455cf657740b1510e223ab728415978fff')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  avatar_url = VALUES(avatar_url),
  status = VALUES(status),
  password_hash = VALUES(password_hash);

INSERT IGNORE INTO user_settings (user_id)
SELECT id FROM users WHERE email IN ('asha@example.com', 'rohan@example.com', 'mira@example.com');

SET @asha_id = (SELECT id FROM users WHERE email = 'asha@example.com' LIMIT 1);
SET @rohan_id = (SELECT id FROM users WHERE email = 'rohan@example.com' LIMIT 1);
SET @mira_id = (SELECT id FROM users WHERE email = 'mira@example.com' LIMIT 1);

INSERT INTO workspaces (owner_id, name, description, color)
SELECT @asha_id, 'Product Launch', 'Demo workspace for launch planning and cross-functional execution.', 'bg-cyan-500'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE owner_id = @asha_id AND name = 'Product Launch');

INSERT INTO workspaces (owner_id, name, description, color)
SELECT @asha_id, 'Research Lab', 'Demo workspace for AI research notes and experiments.', 'bg-violet-500'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE owner_id = @asha_id AND name = 'Research Lab');

SET @launch_id = (SELECT id FROM workspaces WHERE owner_id = @asha_id AND name = 'Product Launch' LIMIT 1);
SET @research_id = (SELECT id FROM workspaces WHERE owner_id = @asha_id AND name = 'Research Lab' LIMIT 1);

INSERT IGNORE INTO workspace_members (workspace_id, user_id, role)
VALUES
  (@launch_id, @asha_id, 'owner'),
  (@launch_id, @rohan_id, 'admin'),
  (@launch_id, @mira_id, 'member'),
  (@research_id, @asha_id, 'owner'),
  (@research_id, @mira_id, 'admin');

INSERT INTO teams (workspace_id, name, description, created_by)
SELECT @launch_id, 'Launch Team', 'Marketing, product, and engineering launch owners.', @asha_id
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE workspace_id = @launch_id AND name = 'Launch Team');

SET @launch_team_id = (SELECT id FROM teams WHERE workspace_id = @launch_id AND name = 'Launch Team' LIMIT 1);

INSERT IGNORE INTO team_members (team_id, user_id, role)
VALUES
  (@launch_team_id, @asha_id, 'lead'),
  (@launch_team_id, @rohan_id, 'member'),
  (@launch_team_id, @mira_id, 'member');

INSERT INTO projects (workspace_id, name, description, color, created_by)
SELECT @launch_id, 'Website Refresh', 'Ship the public landing page and dashboard polish.', 'bg-blue-500', @asha_id
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE workspace_id = @launch_id AND name = 'Website Refresh');

INSERT INTO projects (workspace_id, name, description, color, created_by)
SELECT @launch_id, 'Customer Beta', 'Coordinate customer beta tasks and feedback triage.', 'bg-emerald-500', @rohan_id
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE workspace_id = @launch_id AND name = 'Customer Beta');

SET @website_project_id = (SELECT id FROM projects WHERE workspace_id = @launch_id AND name = 'Website Refresh' LIMIT 1);
SET @beta_project_id = (SELECT id FROM projects WHERE workspace_id = @launch_id AND name = 'Customer Beta' LIMIT 1);

INSERT IGNORE INTO labels (workspace_id, name, color)
VALUES
  (@launch_id, 'Design', 'bg-pink-500'),
  (@launch_id, 'Engineering', 'bg-sky-500'),
  (@launch_id, 'Customer', 'bg-amber-500');

SET @design_label_id = (SELECT id FROM labels WHERE workspace_id = @launch_id AND name = 'Design' LIMIT 1);
SET @engineering_label_id = (SELECT id FROM labels WHERE workspace_id = @launch_id AND name = 'Engineering' LIMIT 1);
SET @customer_label_id = (SELECT id FROM labels WHERE workspace_id = @launch_id AND name = 'Customer' LIMIT 1);

INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assignee_id, created_by, due_date)
SELECT @launch_id, @website_project_id, 'Polish dashboard empty states', 'Review core dashboard panels and make empty states useful.', 'in-progress', 'high', @mira_id, @asha_id, DATE_ADD(CURDATE(), INTERVAL 3 DAY)
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE workspace_id = @launch_id AND title = 'Polish dashboard empty states');

INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assignee_id, created_by, due_date)
SELECT @launch_id, @beta_project_id, 'Prepare beta feedback summary', 'Summarize beta feedback into themes for the launch meeting.', 'todo', 'medium', @rohan_id, @asha_id, DATE_ADD(CURDATE(), INTERVAL 6 DAY)
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE workspace_id = @launch_id AND title = 'Prepare beta feedback summary');

INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assignee_id, created_by, due_date, completed_at)
SELECT @launch_id, @website_project_id, 'Finalize launch checklist', 'Confirm release readiness items and owner handoffs.', 'done', 'urgent', @asha_id, @asha_id, CURDATE(), CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE workspace_id = @launch_id AND title = 'Finalize launch checklist');

SET @empty_states_task_id = (SELECT id FROM tasks WHERE workspace_id = @launch_id AND title = 'Polish dashboard empty states' LIMIT 1);
SET @feedback_task_id = (SELECT id FROM tasks WHERE workspace_id = @launch_id AND title = 'Prepare beta feedback summary' LIMIT 1);
SET @checklist_task_id = (SELECT id FROM tasks WHERE workspace_id = @launch_id AND title = 'Finalize launch checklist' LIMIT 1);

INSERT IGNORE INTO task_labels (task_id, label_id)
VALUES
  (@empty_states_task_id, @design_label_id),
  (@empty_states_task_id, @engineering_label_id),
  (@feedback_task_id, @customer_label_id),
  (@checklist_task_id, @engineering_label_id);

INSERT INTO task_subtasks (task_id, title, completed, sort_order)
SELECT @empty_states_task_id, 'Audit dashboard panels', TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM task_subtasks WHERE task_id = @empty_states_task_id AND title = 'Audit dashboard panels');

INSERT INTO task_subtasks (task_id, title, completed, sort_order)
SELECT @empty_states_task_id, 'Add final microcopy', FALSE, 2
WHERE NOT EXISTS (SELECT 1 FROM task_subtasks WHERE task_id = @empty_states_task_id AND title = 'Add final microcopy');

INSERT INTO task_comments (task_id, user_id, body)
SELECT @empty_states_task_id, @asha_id, 'Please tag @mira when the final empty state copy is ready.'
WHERE NOT EXISTS (SELECT 1 FROM task_comments WHERE task_id = @empty_states_task_id AND body = 'Please tag @mira when the final empty state copy is ready.');

INSERT INTO notes (workspace_id, project_id, title, content, doc_type, created_by, updated_by)
SELECT @launch_id, @website_project_id, 'Launch Brief', '# Launch Brief\n\nCore goals, risks, and weekly decisions for the product launch.', 'documentation', @asha_id, @asha_id
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE workspace_id = @launch_id AND title = 'Launch Brief');

SET @launch_note_id = (SELECT id FROM notes WHERE workspace_id = @launch_id AND title = 'Launch Brief' LIMIT 1);

INSERT IGNORE INTO note_task_links (note_id, task_id)
VALUES (@launch_note_id, @checklist_task_id);

INSERT INTO automations (workspace_id, name, description, trigger_type, action_type, config, created_by)
SELECT @launch_id, 'Due soon reminder', 'Notify task assignees when work is due soon.', 'due_soon', 'notify_assignee', JSON_OBJECT('daysBeforeDue', 2), @asha_id
WHERE NOT EXISTS (SELECT 1 FROM automations WHERE workspace_id = @launch_id AND name = 'Due soon reminder');

INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
SELECT @mira_id, 'assignment', 'New task assignment', 'You were assigned to polish dashboard empty states.', 'task', @empty_states_task_id
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = @mira_id AND entity_type = 'task' AND entity_id = @empty_states_task_id);

INSERT INTO ai_prompt_templates (user_id, name, category, system_prompt, prompt_prefix, is_default)
SELECT @asha_id, 'Workspace Coach', 'productivity', 'You are a concise workspace productivity coach.', 'Review this workspace and suggest the next practical step:', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_templates WHERE user_id = @asha_id AND name = 'Workspace Coach');

INSERT INTO activity_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
SELECT @launch_id, @asha_id, 'seeded', 'workspace', @launch_id, JSON_OBJECT('source', 'database/seed.sql')
WHERE NOT EXISTS (SELECT 1 FROM activity_events WHERE workspace_id = @launch_id AND action = 'seeded' AND entity_type = 'workspace');

SET FOREIGN_KEY_CHECKS = 1;
