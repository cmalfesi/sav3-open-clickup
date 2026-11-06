CREATE TABLE `AutomationRule` (
	`id` text PRIMARY KEY NOT NULL,
	`listId` text NOT NULL,
	`createdBy` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AutomationRun` (
	`id` text PRIMARY KEY NOT NULL,
	`ruleId` text NOT NULL,
	`taskId` text NOT NULL,
	`eventKey` text NOT NULL,
	`status` text NOT NULL,
	`detail` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`ruleId`) REFERENCES `AutomationRule`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AutomationRun_eventKey_unique` ON `AutomationRun` (`eventKey`);--> statement-breakpoint
CREATE INDEX `AutomationRun_rule_index` ON `AutomationRun` (`ruleId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `IdempotentRequest` (
	`key` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`requestHash` text NOT NULL,
	`status` integer,
	`response` text,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `OAuthLoginState` (
	`stateHash` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`verifier` text NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `OperationSetting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updatedAt` integer NOT NULL,
	`updatedBy` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `PasswordRecovery` (
	`tokenHash` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`usedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Reminder` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`userId` text NOT NULL,
	`dueAt` integer NOT NULL,
	`body` text NOT NULL,
	`deliveredAt` integer,
	`cancelled` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Reminder_due_index` ON `Reminder` (`dueAt`,`deliveredAt`);--> statement-breakpoint
CREATE TABLE `StageTransition` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`taskId` text NOT NULL,
	`listId` text NOT NULL,
	`fromId` text,
	`toId` text NOT NULL,
	`occurredAt` integer NOT NULL,
	`baseline` integer DEFAULT 0 NOT NULL,
	`actorId` text,
	`source` text,
	FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `StageTransition_task_index` ON `StageTransition` (`taskId`,`occurredAt`);--> statement-breakpoint
CREATE TABLE `TrashEntity` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`entityId` text NOT NULL,
	`batchId` text NOT NULL,
	`name` text NOT NULL,
	`listId` text,
	`previousArchived` integer DEFAULT 0 NOT NULL,
	`deletedBy` text NOT NULL,
	`deletedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `TrashEntity_kind_entityId_unique` ON `TrashEntity` (`kind`,`entityId`);--> statement-breakpoint
CREATE INDEX `TrashEntity_batch_index` ON `TrashEntity` (`batchId`);--> statement-breakpoint
CREATE TABLE `WebhookDelivery` (
	`id` text PRIMARY KEY NOT NULL,
	`endpointId` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`nextAt` integer NOT NULL,
	`detail` text,
	FOREIGN KEY (`endpointId`) REFERENCES `WebhookEndpoint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `WebhookDelivery_pending_index` ON `WebhookDelivery` (`status`,`nextAt`);--> statement-breakpoint
CREATE TABLE `WebhookEndpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`createdBy` text NOT NULL,
	`listId` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO StageTransition(taskId,listId,fromId,toId,occurredAt,baseline,source) SELECT id,listId,NULL,statusId,CAST(strftime('%s','now') AS INTEGER)*1000,1,'baseline' FROM Task;
--> statement-breakpoint
CREATE TRIGGER Task_stage_insert AFTER INSERT ON Task BEGIN
 INSERT INTO StageTransition(taskId,listId,toId,occurredAt,baseline,source) VALUES(NEW.id,NEW.listId,NEW.statusId,CAST(strftime('%s','now') AS INTEGER)*1000,0,'system');
 INSERT OR IGNORE INTO CustomFieldValue(id,taskId,customFieldId,value) SELECT lower(hex(randomblob(16))),NEW.id,f.id,json_quote(json_extract(f.config,'$.defaultValue')) FROM CustomField f JOIN List l ON l.id=NEW.listId WHERE (f.listId=l.id OR EXISTS(SELECT 1 FROM CustomFieldLocation p WHERE p.customFieldId=f.id AND(p.listId=l.id OR p.spaceId=l.spaceId))) AND json_valid(f.config) AND json_type(f.config,'$.defaultValue') IS NOT NULL AND json_type(f.config,'$.defaultValue')<>'null' AND f.type<>'FORMULA';
END;
--> statement-breakpoint
CREATE TRIGGER Task_stage_change AFTER UPDATE OF statusId,listId ON Task WHEN OLD.statusId<>NEW.statusId OR OLD.listId<>NEW.listId BEGIN
 INSERT INTO StageTransition(taskId,listId,fromId,toId,occurredAt,baseline,source) VALUES(NEW.id,NEW.listId,OLD.statusId,NEW.statusId,CAST(strftime('%s','now') AS INTEGER)*1000,0,'system');
END;
--> statement-breakpoint
CREATE TRIGGER Task_required_transition BEFORE UPDATE OF statusId ON Task WHEN OLD.statusId<>NEW.statusId AND EXISTS(
 SELECT 1 FROM CustomField f JOIN List l ON l.id=NEW.listId LEFT JOIN CustomFieldValue v ON v.taskId=NEW.id AND v.customFieldId=f.id WHERE (f.listId=l.id OR EXISTS(SELECT 1 FROM CustomFieldLocation p WHERE p.customFieldId=f.id AND(p.listId=l.id OR p.spaceId=l.spaceId))) AND json_extract(CASE WHEN json_valid(f.config) THEN f.config ELSE '{}' END,'$.required')=1 AND(v.value IS NULL OR v.value='null' OR v.value='""' OR v.value='[]')
) BEGIN SELECT RAISE(ABORT,'REQUIRED_FIELDS'); END;
