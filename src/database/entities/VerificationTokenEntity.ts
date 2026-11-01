import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm";
import { timestampColumnType } from "../columnTypes.js";
import { CoreEntity } from "./CoreEntity.js";
import type { UserEntity } from "./UserEntity.js";

@Entity("verification_tokens")
export class VerificationTokenEntity extends CoreEntity {
  @Column({ type: "uuid" })
  user_id!: string;

  @ManyToOne("UserEntity", (user: UserEntity) => user.tokens, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: Relation<UserEntity>;

  @Index()
  @Column({ type: "varchar", length: 64 })
  token_hash!: string;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "int", default: 3 })
  max_attempts!: number;

  @Column({ type: timestampColumnType as "datetime" })
  expires_at!: Date;

  @Column({ type: timestampColumnType as "datetime", nullable: true })
  used_at?: Date | null;
}
