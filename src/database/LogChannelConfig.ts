import {
    BaseEntity,
    Column,
    Entity,
    PrimaryColumn
} from 'typeorm';

import {
    logTypes
} from '../slash-commands/logging-channel.js';

@Entity()
export default class LogChannelConfig extends BaseEntity {
    @PrimaryColumn({
        length: 32,
        unique: true
    })
    guildId!: string;

    @Column({
        length: 32,
    })
    channelId!: string;

    @Column('simple-array', {
        nullable: true
    })
    logs!: typeof logTypes[number][];

    @Column('simple-json', {
        nullable: true
    })
    logMentions!: { [key in typeof logTypes[number]]?: string; }
}