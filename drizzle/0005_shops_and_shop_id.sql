CREATE TABLE `shops` (
	`id` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shops_id` PRIMARY KEY(`id`)
);

INSERT INTO `shops` (`id`, `name`) VALUES ('default-shop', '默认店铺');

ALTER TABLE `product_records` ADD `shopId` varchar(64) NOT NULL DEFAULT 'default-shop';
CREATE INDEX `product_records_shop_idx` ON `product_records` (`shopId`);

ALTER TABLE `live_product_listings` ADD `shopId` varchar(64) NOT NULL DEFAULT 'default-shop';
ALTER TABLE `live_product_listings` DROP INDEX `live_product_listings_spuId_unique`;
CREATE UNIQUE INDEX `live_product_listings_shop_spu_unique` ON `live_product_listings` (`shopId`, `spuId`);
