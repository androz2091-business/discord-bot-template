import {
    Entity,
    BaseEntity,
    PrimaryColumn,
    Column
} from 'typeorm';

@Entity()
export default class Config extends BaseEntity {
    @PrimaryColumn({
        length: 32,
    })
    guildId!: string;

    @PrimaryColumn()
    key!: string;

    @Column({
        nullable: true
    })
    type!: 'boolean' | 'string' | 'number';

    @Column({
        nullable: true
    })
    booleanValue!: boolean;

    @Column({
        nullable: true
    })
    stringValue!: string;

    @Column({
        nullable: true
    })
    numberValue!: number;
}