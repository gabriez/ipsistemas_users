import type { MigrationInterface, QueryRunner } from "typeorm";

export class CoreSchema1793529059450 implements MigrationInterface {
  name = "CoreSchema1793529059450";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`verification_tokens\` (
                \`id\` uuid NOT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deleted_at\` datetime(6) NULL,
                \`user_id\` uuid NOT NULL,
                \`token_hash\` varchar(64) NOT NULL,
                \`attempts\` int NOT NULL DEFAULT '0',
                \`max_attempts\` int NOT NULL DEFAULT '3',
                \`expires_at\` timestamp NOT NULL,
                \`used_at\` timestamp NULL,
                INDEX \`IDX_19d8484a0754cd015ca11302a5\` (\`token_hash\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`users\` (
                \`id\` uuid NOT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deleted_at\` datetime(6) NULL,
                \`email\` varchar(255) NOT NULL,
                \`telegram_id\` bigint NULL,
                \`outline_id\` varchar(255) NULL,
                \`status\` varchar(20) NOT NULL DEFAULT 'PENDING',
                \`is_verified\` tinyint NOT NULL DEFAULT 0,
                \`verified_at\` timestamp NULL,
                UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`),
                UNIQUE INDEX \`IDX_1a1e4649fd31ea6ec6b025c7bf\` (\`telegram_id\`),
                UNIQUE INDEX \`IDX_d09c3c1e3aadee2c0d0e9a6b08\` (\`outline_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            ALTER TABLE \`verification_tokens\`
            ADD CONSTRAINT \`FK_31d2079dc4079b80517d31cf4f2\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`verification_tokens\` DROP FOREIGN KEY \`FK_31d2079dc4079b80517d31cf4f2\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_d09c3c1e3aadee2c0d0e9a6b08\` ON \`users\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_1a1e4649fd31ea6ec6b025c7bf\` ON \`users\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_d09c3c1e3aadee2c0d0e9a6b08\` ON \`users\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_1a1e4649fd31ea6ec6b025c7bf\` ON \`users\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\`
        `);
    await queryRunner.query(`
            DROP TABLE \`users\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_19d8484a0754cd015ca11302a5\` ON \`verification_tokens\`
        `);
    await queryRunner.query(`
            DROP TABLE \`verification_tokens\`
        `);
  }
}
