CREATE TABLE `ReportDelivery` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduleId` text NOT NULL,
	`slot` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`scheduleId`) REFERENCES `ReportSchedule`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ReportDelivery_schedule_slot` ON `ReportDelivery` (`scheduleId`,`slot`);--> statement-breakpoint
CREATE TABLE `ReportSchedule` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`dashboardId` text NOT NULL,
	`frequency` text NOT NULL,
	`hour` integer NOT NULL,
	`timezone` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dashboardId`) REFERENCES `Dashboard`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `WebhookDelivery` ADD `lockedUntil` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TRIGGER ChangeEvent_webhook AFTER INSERT ON ChangeEvent BEGIN
 INSERT INTO WebhookDelivery(id,endpointId,payload,nextAt) SELECT e.id||':'||NEW.seq,e.id,json_object('id',e.id||':'||NEW.seq,'event','task.changed','taskId',NEW.taskId,'listId',NEW.listId,'actorId',NEW.actorId,'createdAt',NEW.createdAt),NEW.createdAt FROM WebhookEndpoint e WHERE e.listId=NEW.listId AND e.enabled=1;
END;
