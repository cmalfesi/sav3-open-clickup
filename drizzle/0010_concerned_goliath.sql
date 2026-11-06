ALTER TABLE `StageTransition` ADD `fieldId` text DEFAULT '__status__' NOT NULL;
--> statement-breakpoint
INSERT INTO StageTransition(taskId,listId,toId,occurredAt,baseline,source,fieldId) SELECT v.taskId,t.listId,json_extract(v.value,'$'),CAST(strftime('%s','now') AS INTEGER)*1000,1,'baseline',v.customFieldId FROM CustomFieldValue v JOIN CustomField f ON f.id=v.customFieldId AND f.type='DROPDOWN' JOIN Task t ON t.id=v.taskId WHERE json_type(v.value)='text';
--> statement-breakpoint
CREATE TRIGGER CustomFieldValue_stage_insert AFTER INSERT ON CustomFieldValue WHEN EXISTS(SELECT 1 FROM CustomField WHERE id=NEW.customFieldId AND type='DROPDOWN') AND json_type(NEW.value)='text' BEGIN
 INSERT INTO StageTransition(taskId,listId,toId,occurredAt,baseline,source,fieldId) SELECT NEW.taskId,t.listId,json_extract(NEW.value,'$'),CAST(strftime('%s','now') AS INTEGER)*1000,0,'system',NEW.customFieldId FROM Task t WHERE t.id=NEW.taskId;
END;
--> statement-breakpoint
CREATE TRIGGER CustomFieldValue_stage_change AFTER UPDATE OF value ON CustomFieldValue WHEN OLD.value<>NEW.value AND EXISTS(SELECT 1 FROM CustomField WHERE id=NEW.customFieldId AND type='DROPDOWN') AND json_type(NEW.value)='text' BEGIN
 INSERT INTO StageTransition(taskId,listId,fromId,toId,occurredAt,baseline,source,fieldId) SELECT NEW.taskId,t.listId,json_extract(OLD.value,'$'),json_extract(NEW.value,'$'),CAST(strftime('%s','now') AS INTEGER)*1000,0,'system',NEW.customFieldId FROM Task t WHERE t.id=NEW.taskId;
END;

--> statement-breakpoint
CREATE TRIGGER CustomFieldValue_stage_clear AFTER DELETE ON CustomFieldValue WHEN EXISTS(SELECT 1 FROM CustomField WHERE id=OLD.customFieldId AND type='DROPDOWN') BEGIN
 INSERT INTO StageTransition(taskId,listId,fromId,toId,occurredAt,baseline,source,fieldId) SELECT OLD.taskId,t.listId,json_extract(OLD.value,'$'),'__empty__',CAST(strftime('%s','now') AS INTEGER)*1000,0,'system',OLD.customFieldId FROM Task t WHERE t.id=OLD.taskId;
END;
--> statement-breakpoint
DROP TRIGGER CustomFieldOption_protect_values;
--> statement-breakpoint
CREATE TRIGGER CustomFieldOption_protect_values BEFORE DELETE ON CustomFieldOption WHEN EXISTS(SELECT 1 FROM CustomField f WHERE f.id=OLD.customFieldId AND f.type IN('DROPDOWN','LABELS')) AND EXISTS(SELECT 1 FROM CustomFieldValue v WHERE v.customFieldId=OLD.customFieldId AND(v.value=json_quote(OLD.id) OR EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(v.value) THEN v.value ELSE 'null' END) WHERE value=OLD.id))) BEGIN SELECT RAISE(ABORT,'OPTION_IN_USE'); END;
