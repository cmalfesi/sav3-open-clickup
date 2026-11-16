ALTER TABLE `ChecklistItem` ADD `assigneeId` text REFERENCES User(id) ON DELETE SET NULL;
--> statement-breakpoint
-- Assign each existing identity a distinct, persistent avatar background.
WITH numbered AS (SELECT id,row_number() OVER (ORDER BY id)-1 n FROM User)
UPDATE User SET color=(SELECT CASE n WHEN 0 THEN '#5b4bb7' WHEN 1 THEN '#b33b55' WHEN 2 THEN '#18705c' WHEN 3 THEN '#a04b13' WHEN 4 THEN '#2368a2' WHEN 5 THEN '#843f99' WHEN 6 THEN '#586524' WHEN 7 THEN '#b03925' WHEN 8 THEN '#14717d' WHEN 9 THEN '#805346' WHEN 10 THEN '#384ca6' WHEN 11 THEN '#9a386f' WHEN 12 THEN '#276f38' WHEN 13 THEN '#8b5e12' WHEN 14 THEN '#4d5c72' WHEN 15 THEN '#694db2' WHEN 16 THEN '#9a422f' WHEN 17 THEN '#116b91' WHEN 18 THEN '#735c26' WHEN 19 THEN '#674964' ELSE 'hsl(' || ((n * 137) % 360) || ' ' || (55 + ((n / 360) % 10)) || '% ' || (28 + ((n / 3600) % 8)) || '%)' END FROM numbered WHERE numbered.id=User.id);
