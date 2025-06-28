import { IsArray, IsDateString, IsNotEmpty, IsObject } from 'class-validator';

export class AgendarCampañaDto {
    @IsNotEmpty()
    @IsDateString()
    fechaAgenda: string;

    @IsArray()
    sessionIds: string[];

    @IsObject()
    config: any;
}