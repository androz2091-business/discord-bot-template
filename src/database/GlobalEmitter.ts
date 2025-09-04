import {
    Entity,
    BaseEntity,
    PrimaryColumn,
    Column
} from 'typeorm';

@Entity()
export default class GlobalEmitter extends BaseEntity {
    @PrimaryColumn({
        length: 36
    })
    id!: string;

    @Column()
    event!: string;

    @Column()
    context!: string;
}