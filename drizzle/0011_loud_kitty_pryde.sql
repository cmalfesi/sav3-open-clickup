CREATE TABLE `UserPresence` (
	`userId` text NOT NULL,
	`clientId` text NOT NULL,
	`sessionId` text,
	`lastSeen` integer NOT NULL,
	`lastActive` integer NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`userId`, `clientId`),
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `UserPresence_lastSeen_index` ON `UserPresence` (`lastSeen`);