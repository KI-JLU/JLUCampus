-- Custom SQL migration file, put your code below! --
UPDATE "component" SET "secrets" = "secrets" - 'apiKey' WHERE "type" = 'translator';
