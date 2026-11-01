import { Column, Entity, Index, OneToMany, type Relation, type ValueTransformer } from "typeorm";
import { UserStatus, type UserStatusType } from "../../types/user.types.js";
import { timestampColumnType } from "../columnTypes.js";
import { CoreEntity } from "./CoreEntity.js";
import type { VerificationTokenEntity } from "./VerificationTokenEntity.js";

export { UserStatus, type UserStatusType };

const bigIntTransformer: ValueTransformer = {
  to: (value?: string | null) => (value ? String(value) : null),
  from: (value?: string | number | null) => (value != null ? String(value) : null),
};

@Entity("users")
export class UserEntity extends CoreEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Index({ unique: true })
  @Column({
    type: "bigint",
    nullable: true,
    transformer: bigIntTransformer,
  })
  telegram_id?: string | null;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, nullable: true })
  outline_id?: string | null;

  @Column({
    type: "varchar",
    length: 20,
    default: UserStatus.PENDING,
  })
  status!: UserStatusType;

  @Column({ type: "boolean", default: false })
  is_verified!: boolean;

  @Column({ type: timestampColumnType as "datetime", nullable: true })
  verified_at?: Date | null;

  @OneToMany("VerificationTokenEntity", (token: VerificationTokenEntity) => token.user, {
    cascade: ["remove"],
  })
  tokens!: Relation<VerificationTokenEntity[]>;
}
