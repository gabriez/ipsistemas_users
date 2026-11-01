import { Column, Entity, Index, OneToMany, type ValueTransformer } from "typeorm";
import { UserStatus, type UserStatusType } from "../../types/user.types.js";
import { timestampColumnType } from "../columnTypes.js";
import { CoreEntity } from "./CoreEntity.js";
import { VerificationTokenEntity } from "./VerificationTokenEntity.js";

export { UserStatus, type UserStatusType };

const bigIntTransformer: ValueTransformer = {
  to: (value?: string | null) => (value ? String(value) : null),
  from: (value?: string | number | null) => (value != null ? String(value) : null),
};

@Entity("users")
export class UserEntity extends CoreEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Index({ unique: true })
  @Column({
    type: "bigint",
    nullable: true,
    unique: true,
    transformer: bigIntTransformer,
  })
  telegram_id?: string | null;

  @Index()
  @Column({ type: "varchar", length: 255, nullable: true, unique: true })
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

  @OneToMany(
    () => VerificationTokenEntity,
    (token) => token.user,
    {
      cascade: ["remove"],
    },
  )
  tokens!: VerificationTokenEntity[];
}
